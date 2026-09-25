import type { OptValidatorItem, OptValidatorResult } from '../xml/optValidator.js';

export type OptInterpretationCategory =
  | 'xml-correction'
  | 'author-instruction'
  | 'external-file-change'
  | 'confirmation-required'
  | 'informational'
  | 'unknown';

export type OptInterpretationScope =
  | 'main-xml'
  | 'supplementary-file'
  | 'other-file'
  | 'unknown';

export type OptInterpretationAction =
  | 'apply-xml-change'
  | 'create-jm-query'
  | 'record-only'
  | 'human-review'
  | 'none';

export interface OptInterpretation {
  category: OptInterpretationCategory;
  scope: OptInterpretationScope;
  action: OptInterpretationAction;
  confidence: 'high' | 'medium' | 'low';
  finding: string;
  relatedItems: number[];
  requestedChange?: {
    from: string;
    to: string;
  };
}

export interface OptInterpretationResult {
  detected: boolean;
  total: number;
  interpretations: OptInterpretation[];
  warnings: string[];
}

export interface OptInterpreterRequest {
  validation: OptValidatorResult;
  context?: Record<string, unknown>;
}

function getSharedIds(
  first: OptValidatorItem,
  second: OptValidatorItem
): string[] {
  const secondIds = new Set(second.ids);

  return first.ids.filter((id) => secondIds.has(id));
}

function findReplacementPairs(
  items: OptValidatorItem[]
): OptInterpretation[] {
  const interpretations: OptInterpretation[] = [];

  for (let index = 0; index < items.length - 1; index++) {
    const first = items[index];
    const second = items[index + 1];

    if (first.type !== 'DEL' || second.type !== 'INS') {
      continue;
    }

    const sharedIds = getSharedIds(first, second);

    if (sharedIds.length === 0) {
      continue;
    }

    interpretations.push({
      category: 'xml-correction',
      scope: 'main-xml',
      action: 'apply-xml-change',
      confidence: 'high',
      finding:
        `OPT_DEL and OPT_INS appear to form a replacement pair based on shared nested ID(s): ${sharedIds.join(', ')}.`,
      relatedItems: [first.order, second.order],
    });
  }

  return interpretations;
}

function extractRequestedChange(
  content: string
): { from: string; to: string } | null {
  const normalized = content
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"');

  const match = normalized.match(
    /please\s+change\s+"([^"]+)"\s+to\s+"([^"]+)"/i
  );

  if (!match) {
    return null;
  }

  return {
    from: match[1].trim(),
    to: match[2].trim(),
  };
}

function isBarePhraseCorrectionMarker(content: string): boolean {
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return false;
  }

  const wordCount = trimmed.split(/\s+/).length;

  if (wordCount > 6) {
    return false;
  }

  const sentenceSignals = /\b(please|change|to|the|and|is|are|should|needs?)\b/i;

  if (sentenceSignals.test(trimmed)) {
    return false;
  }

  // Bare phrases of interest typically contain a dash/hyphen variant or
  // similar punctuation swap candidate (e.g. em dash vs en dash), or are
  // otherwise short symbolic fragments with no sentence structure.
  return true;
}

function interpretComment(
  item: OptValidatorItem
): OptInterpretation | null {
  if (item.type !== 'COMMENT') {
    return null;
  }

  const text = item.content.toLowerCase();

  const supplementaryScope =
    text.includes('supplementary information') ||
    text.includes('supplementary material') ||
    text.includes('supplementary file');

  if (supplementaryScope) {
    const updateSignals = [
      'needs to be updated',
      'needs to be replaced',
      'updated version',
      'corrected version',
      'replace',
      'replacement',
      'update',
    ];

    const hasUpdateSignal = updateSignals.some((signal) =>
      text.includes(signal)
    );

    if (hasUpdateSignal) {
      return {
        category: 'external-file-change',
        scope: 'supplementary-file',
        action: 'create-jm-query',
        confidence: 'high',
        finding:
          'The OPT_COMMENT describes an update or replacement involving supplementary material. The specific supplementary file should be identified from production context rather than inferred from the comment alone.',
        relatedItems: [item.order],
      };
    }
  }

  const requestedChange = extractRequestedChange(item.content);

  if (requestedChange) {
    return {
      category: 'xml-correction',
      scope: 'main-xml',
      action: 'human-review',
      confidence: 'high',
      finding:
        `The OPT_COMMENT explicitly requests changing "${requestedChange.from}" to "${requestedChange.to}" at the comment location.`,
      relatedItems: [item.order],
      requestedChange,
    };
  }

  if (isBarePhraseCorrectionMarker(item.content)) {
    return {
      category: 'xml-correction',
      scope: 'main-xml',
      action: 'human-review',
      confidence: 'low',
      finding:
        `The OPT_COMMENT is a short bare-phrase marker ("${item.content}") with no explicit "please change X to Y" wording. It likely refers to a correction pattern stated explicitly elsewhere in this document. No replacement target is inferred here; a human reviewer or the Resolver should confirm the intended change.`,
      relatedItems: [item.order],
    };
  }

  return {
    category: 'unknown',
    scope: 'unknown',
    action: 'human-review',
    confidence: 'low',
    finding:
      `The OPT_COMMENT was detected but does not match a recognized correction or instruction pattern. The full comment text should be reviewed: "${item.content}"`,
    relatedItems: [item.order],
  };
}

function interpretComments(
  items: OptValidatorItem[]
): OptInterpretation[] {
  const interpretations: OptInterpretation[] = [];

  for (const item of items) {
    const interpretation = interpretComment(item);

    if (interpretation) {
      interpretations.push(interpretation);
    }
  }

  return interpretations;
}

export function interpretOptMarkup(
  request: OptInterpreterRequest
): OptInterpretationResult {
  const { validation } = request;

  if (!validation.detected || validation.items.length === 0) {
    return {
      detected: false,
      total: 0,
      interpretations: [],
      warnings: [],
    };
  }

  const interpretations = [
    ...findReplacementPairs(validation.items),
    ...interpretComments(validation.items),
  ];

  return {
    detected: true,
    total: validation.items.length,
    interpretations,
    warnings: [],
  };
}

