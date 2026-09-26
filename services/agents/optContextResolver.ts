import type { OptValidatorItem, OptValidatorResult } from '../xml/optValidator.js';

export type OptContextResolutionStatus =
  | 'resolved'
  | 'duplicate'
  | 'ambiguous'
  | 'unresolved';

export interface OptContextResolution {
  status: OptContextResolutionStatus;
  commentOrder: number;
  commentId?: string;
  requestedChange?: {
    from: string;
    to: string;
  };
  targetXml?: string;
  targetText?: string;
  relatedItems: number[];
  reason: string;
}

export interface OptContextResolverRequest {
  xml: string;
  validation: OptValidatorResult;
  requestedChanges: Array<{
    order: number;
    from: string;
    to: string;
  }>;
}

function normalizeDash(value: string): string {
  return value
    .replace(/[\u2012\u2013\u2014\u2212]/g, '–')
    .replace(/[\u00AD]/g, '');
}

function normalizeForMatching(value: string): string {
  return normalizeDash(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlToComparableText(xml: string): string {
  return normalizeForMatching(
    xml
      .replace(
        /<ce:glyph\b[^>]*name\s*=\s*"sbnd"[^>]*\/?>/gi,
        '–'
      )
      .replace(/<opt_[A-Za-z0-9_-]+(?:\s+[^>]*)?>[\s\S]*?<\/opt_[A-Za-z0-9_-]+\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function locateRequestedTarget(
  source: string,
  requestedFrom: string
): { found: string; startRel: number; endRel: number } | null {
  const normalizedSource = xmlToComparableText(source);
  const normalizedFrom = normalizeForMatching(requestedFrom);

  if (!normalizedFrom) {
    return null;
  }

  const startRel = normalizedSource.lastIndexOf(normalizedFrom);

  if (startRel < 0) {
    return null;
  }

  return {
    found: normalizedFrom,
    startRel,
    endRel: startRel + normalizedFrom.length,
  };
}

function locateTargetXml(
  source: string,
  requestedFrom: string
): { found: string; startRel: number; endRel: number } | null {
  const normalizedFrom = normalizeForMatching(requestedFrom);

  if (!normalizedFrom) {
    return null;
  }

  const dashParts = normalizedFrom.split(/[\u2012\u2013\u2014\u2212-]/);

  if (dashParts.length === 2) {
    const left = dashParts[0]
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const right = dashParts[1]
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const glyphPattern = new RegExp(
      left +
        `<ce:glyph\\b[^>]*name\\s*=\\s*["']sbnd["'][^>]*/?>` +
        right,
      'gi'
    );

    const glyphMatch = glyphPattern.exec(source);

    if (glyphMatch) {
      return {
        found: glyphMatch[0],
        startRel: glyphMatch.index,
        endRel: glyphMatch.index + glyphMatch[0].length,
      };
    }
  }

  const escaped = normalizedFrom.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  const literalPattern = new RegExp(escaped, 'gi');
  const literalMatch = literalPattern.exec(source);

  if (literalMatch) {
    return {
      found: literalMatch[0],
      startRel: literalMatch.index,
      endRel: literalMatch.index + literalMatch[0].length,
    };
  }

  return null;
}

function getPreviousItem(
  items: OptValidatorItem[],
  current: OptValidatorItem
): OptValidatorItem | undefined {
  return items.find((item) => item.order === current.order - 1);
}

function isAdjacent(
  previous: OptValidatorItem | undefined,
  current: OptValidatorItem
): boolean {
  return Boolean(
    previous &&
      previous.endOffset === current.startOffset
  );
}

function resolveComment(
  xml: string,
  validation: OptValidatorResult,
  request: {
    order: number;
    from: string;
    to: string;
  },
  requestedChanges: Array<{
    order: number;
    from: string;
    to: string;
  }>
): OptContextResolution {
  const item = validation.items.find(
    (candidate) => candidate.order === request.order
  );

  if (!item || item.type !== 'COMMENT') {
    return {
      status: 'unresolved',
      commentOrder: request.order,
      requestedChange: {
        from: request.from,
        to: request.to,
      },
      relatedItems: [],
      reason: 'The requested comment could not be found in the validated OPT items.',
    };
  }

  const previous = getPreviousItem(validation.items, item);

  /*
   * Consecutive comments are treated separately from normal target
   * resolution. This prevents the second comment from accidentally
   * inheriting text from the first comment.
   */
  if (
    previous &&
    previous.type === 'COMMENT' &&
    isAdjacent(previous, item)
  ) {
    const previousRequestedChange = requestedChanges.find(
      (change) => change.order === previous.order
    );

    const sameRequestedChange =
      previousRequestedChange &&
      previousRequestedChange.from === request.from &&
      previousRequestedChange.to === request.to;

    if (sameRequestedChange) {
      return {
        status: 'duplicate',
        commentOrder: item.order,
        commentId: item.id,
        requestedChange: {
          from: request.from,
          to: request.to,
        },
        relatedItems: [previous.order, item.order],
        reason:
          'This comment is immediately adjacent to the previous OPT_COMMENT and repeats the same correction request.',
      };
    }
  }

  const contextBack = 2000;
  const contextFwd = 500;
  const contextStart = Math.max(0, item.startOffset - contextBack);
  const contextEnd = Math.min(xml.length, item.endOffset + contextFwd);
  const context = xml.slice(contextStart, contextEnd);
  const anchorOffset = item.startOffset - contextStart;

  const targetLocation = locateRequestedTarget(
    context,
    request.from
  );

  if (!targetLocation) {
    return {
      status: 'unresolved',
      commentOrder: item.order,
      commentId: item.id,
      requestedChange: {
        from: request.from,
        to: request.to,
      },
      relatedItems: [item.order],
      reason:
        `The requested source text "${request.from}" could not be reliably located in the XML context surrounding the comment (${contextBack} chars before / ${contextFwd} chars after).`,
    };
  }

  const targetXmlLocation = locateTargetXml(
    context,
    request.from
  );

  const targetDistance = targetLocation.endRel <= anchorOffset
    ? anchorOffset - targetLocation.endRel
    : targetLocation.startRel - anchorOffset;

  return {
    status: 'resolved',
    commentOrder: item.order,
    commentId: item.id,
    requestedChange: {
      from: request.from,
      to: request.to,
    },
    targetXml: targetXmlLocation?.found ?? undefined,
    targetText: targetLocation.found,
    relatedItems: [item.order],
    reason:
      `The requested source text "${request.from}" was found in the XML context surrounding the comment (${contextBack} chars before / ${contextFwd} chars after). Nearest match located ~${targetDistance} chars from the OPT marker.`,
  };
}

export function resolveOptCommentContext(
  request: OptContextResolverRequest
): OptContextResolution[] {
  const resolutions: OptContextResolution[] = [];

  for (const requestedChange of request.requestedChanges) {
    resolutions.push(
      resolveComment(
        request.xml,
        request.validation,
        requestedChange,
        request.requestedChanges
      )
    );
  }

  return resolutions;
}



