import type { OptValidatorItem, OptValidatorResult } from '../xml/optValidator.js';

export type OptContextResolutionStatus =
  | 'resolved'
  | 'resolved-by-sibling-pattern'
  | 'duplicate'
  | 'ambiguous'
  | 'unresolved';

export interface OptContextResolution {
  status: OptContextResolutionStatus;
  commentOrder: number;
  commentIds: number[];
  groupId?: string | null;
  commentId?: string;
  requestedChange?: {
    from: string;
    to: string;
  };
  targetXml?: string;
  targetText?: string;
  targetStartOffset?: number;
  targetEndOffset?: number;
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
  bareCandidates?: Array<{
    order: number;
    content: string;
  }>;
}

const SIBLING_PATTERN_MIN_CLUSTER_SIZE = 3;

function normalizeDash(value: string): string {
  return value
    .replace(/[\u2012\u2013\u2014\u2212]/g, '\u2013')
    .replace(/[\u00AD]/g, '');
}

function normalizeForMatching(value: string): string {
  return normalizeDash(value)
    .replace(/\s+/g, ' ')
    .trim();
}

interface ComparableText {
  text: string;
  rawOffsetAt: number[];
}

function xmlToComparableText(xml: string): ComparableText {
  let text = '';
  const rawOffsetAt: number[] = [];
  const n = xml.length;
  let i = 0;

  const emit = (ch: string, rawIndex: number) => {
    text += ch;
    rawOffsetAt.push(rawIndex);
  };

  while (i < n) {
    const rest = xml.slice(i);

    const glyphMatch = /^<ce:glyph\b[^>]*name\s*=\s*"sbnd"[^>]*\/?>/i.exec(rest);
    if (glyphMatch) {
      emit('\u2013', i);
      i += glyphMatch[0].length;
      continue;
    }

    const optBlockMatch = /^<opt_[A-Za-z0-9_-]+(?:\s+[^>]*)?>[\s\S]*?<\/opt_[A-Za-z0-9_-]+\s*>/i.exec(rest);
    if (optBlockMatch) {
      emit(' ', i);
      i += optBlockMatch[0].length;
      continue;
    }

    const tagMatch = /^<[^>]+>/.exec(rest);
    if (tagMatch) {
      emit(' ', i);
      i += tagMatch[0].length;
      continue;
    }

    const ch = xml[i];

    if (/[\u2012\u2013\u2014\u2212]/.test(ch)) {
      emit('\u2013', i);
      i += 1;
      continue;
    }

    if (ch === '\u00AD') {
      i += 1;
      continue;
    }

    if (/\s/.test(ch)) {
      emit(' ', i);
      i += 1;
      while (i < n && /\s/.test(xml[i])) {
        i += 1;
      }
      continue;
    }

    emit(ch, i);
    i += 1;
  }

  rawOffsetAt.push(n);

  return { text, rawOffsetAt };
}

interface OffsetMatch {
  found: string;
  startRel: number;
  endRel: number;
}

/*
 * KB-002 fix: pick the match nearest to the OPT comment anchor, not simply
 * the last one found. Ties (identical distance forward vs. backward) prefer
 * the backward occurrence, matching the original code's implicit bias
 * (lastIndexOf favored later-in-string matches, which for purely-backward
 * context windows meant "closer to the anchor" -- but broke down once a
 * forward window was added in the 2000/500 fix, and always broke down for
 * cases with 2+ backward occurrences).
 */
function pickNearestMatch(
  matches: OffsetMatch[],
  anchorOffset: number
): OffsetMatch | null {
  if (matches.length === 0) {
    return null;
  }

  let best = matches[0];
  let bestDistance = Math.abs(best.startRel - anchorOffset);

  for (let i = 1; i < matches.length; i++) {
    const candidate = matches[i];
    const distance = Math.abs(candidate.startRel - anchorOffset);

    const strictlyCloser = distance < bestDistance;
    const tiedButBackwardPreferred =
      distance === bestDistance &&
      candidate.startRel < anchorOffset &&
      !(best.startRel < anchorOffset);

    if (strictlyCloser || tiedButBackwardPreferred) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function locateRequestedTarget(
  source: string,
  requestedFrom: string,
  anchorOffset: number
): { found: string; startRel: number; endRel: number } | null {
  const { text: normalizedSource, rawOffsetAt } = xmlToComparableText(source);
  const normalizedFrom = normalizeForMatching(requestedFrom);

  if (!normalizedFrom) {
    return null;
  }

  const matches: OffsetMatch[] = [];
  let searchFrom = 0;

  while (true) {
    const idx = normalizedSource.indexOf(normalizedFrom, searchFrom);

    if (idx < 0) {
      break;
    }

    matches.push({
      found: normalizedFrom,
      startRel: rawOffsetAt[idx],
      endRel: rawOffsetAt[idx + normalizedFrom.length],
    });

    searchFrom = idx + 1;
  }

  return pickNearestMatch(matches, anchorOffset);
}

function locateTargetXml(
  source: string,
  requestedFrom: string,
  anchorOffset: number
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

    const glyphMatches: OffsetMatch[] = [];
    let glyphMatch: RegExpExecArray | null;

    while ((glyphMatch = glyphPattern.exec(source)) !== null) {
      glyphMatches.push({
        found: glyphMatch[0],
        startRel: glyphMatch.index,
        endRel: glyphMatch.index + glyphMatch[0].length,
      });

      if (glyphMatch[0].length === 0) {
        glyphPattern.lastIndex += 1;
      }
    }

    const nearestGlyph = pickNearestMatch(glyphMatches, anchorOffset);

    if (nearestGlyph) {
      return nearestGlyph;
    }
  }

  const escaped = normalizedFrom.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  const literalPattern = new RegExp(escaped, 'gi');
  const literalMatches: OffsetMatch[] = [];
  let literalMatch: RegExpExecArray | null;

  while ((literalMatch = literalPattern.exec(source)) !== null) {
    literalMatches.push({
      found: literalMatch[0],
      startRel: literalMatch.index,
      endRel: literalMatch.index + literalMatch[0].length,
    });

    if (literalMatch[0].length === 0) {
      literalPattern.lastIndex += 1;
    }
  }

  return pickNearestMatch(literalMatches, anchorOffset);
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
      commentIds: [request.order],
      groupId: undefined,
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
        commentIds: [item.order],
        groupId: undefined,
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
    request.from,
    anchorOffset
  );

  if (!targetLocation) {
    return {
      commentIds: [item.order],
      groupId: undefined,
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
    request.from,
    anchorOffset
  );

  const targetDistance = targetLocation.endRel <= anchorOffset
    ? anchorOffset - targetLocation.endRel
    : targetLocation.startRel - anchorOffset;

  return {
    commentIds: [item.order],
    groupId: undefined,
    status: 'resolved',
    commentOrder: item.order,
    commentId: item.id,
    requestedChange: {
      from: request.from,
      to: request.to,
    },
    targetXml: targetXmlLocation?.found ?? undefined,
    targetText: targetLocation.found,
    targetStartOffset: contextStart + targetLocation.startRel,
    targetEndOffset: contextStart + targetLocation.endRel,
    relatedItems: [item.order],
    reason:
      `The requested source text "${request.from}" was found in the XML context surrounding the comment (${contextBack} chars before / ${contextFwd} chars after). Nearest match located ~${targetDistance} chars from the OPT marker.`,
  };
}

interface RequestedChangeCluster {
  normalizedFrom: string;
  normalizedTo: string;
  from: string;
  to: string;
  count: number;
  orders: number[];
}

/*
 * Sibling-pattern clustering (Strategy A1). Groups explicit, already-resolved
 * requestedChange pairs by their normalized (from, to) transformation.
 * Same-file evidence only -- this function never sees more than one file's
 * requestedChanges at a time, by construction of its caller.
 */
function buildRequestedChangeClusters(
  requestedChanges: Array<{ order: number; from: string; to: string }>
): RequestedChangeCluster[] {
  const clusters = new Map<string, RequestedChangeCluster>();

  for (const change of requestedChanges) {
    const normalizedFrom = normalizeForMatching(change.from);
    const normalizedTo = normalizeForMatching(change.to);
    const key = `${normalizedFrom}\u241F${normalizedTo}`;

    const existing = clusters.get(key);

    if (existing) {
      existing.count += 1;
      existing.orders.push(change.order);
    } else {
      clusters.set(key, {
        normalizedFrom,
        normalizedTo,
        from: change.from,
        to: change.to,
        count: 1,
        orders: [change.order],
      });
    }
  }

  return [...clusters.values()];
}

/*
 * For a bare-phrase comment with no explicit "please change X to Y" wording,
 * check whether its raw text matches the before-text of an in-file cluster
 * of >= SIBLING_PATTERN_MIN_CLUSTER_SIZE confirmed explicit siblings sharing
 * the exact same transformation. If exactly one such cluster matches (not
 * zero, not more than one -- an impure/ambiguous match is never auto-applied),
 * auto-populate the requestedChange from the cluster and locate the target
 * text the same way explicit resolutions do.
 *
 * Scope boundary: this stays in the Resolver. It does not re-derive which
 * items are bare-phrase candidates -- that categorization is the Interpreter's
 * job; this function only receives what the caller already flagged as such.
 */
function resolveBareCandidateBySiblingPattern(
  xml: string,
  validation: OptValidatorResult,
  candidate: { order: number; content: string },
  clusters: RequestedChangeCluster[]
): OptContextResolution | null {
  const item = validation.items.find(
    (candidateItem) => candidateItem.order === candidate.order
  );

  if (!item || item.type !== 'COMMENT') {
    return null;
  }

  const normalizedCandidate = normalizeForMatching(candidate.content);

  const matchingClusters = clusters.filter(
    (cluster) => cluster.normalizedFrom === normalizedCandidate
  );

  if (matchingClusters.length !== 1) {
    return null;
  }

  const cluster = matchingClusters[0];

  if (cluster.count < SIBLING_PATTERN_MIN_CLUSTER_SIZE) {
    return null;
  }

  const contextBack = 2000;
  const contextFwd = 500;
  const contextStart = Math.max(0, item.startOffset - contextBack);
  const contextEnd = Math.min(xml.length, item.endOffset + contextFwd);
  const context = xml.slice(contextStart, contextEnd);
  const anchorOffset = item.startOffset - contextStart;

  const targetLocation = locateRequestedTarget(context, cluster.from, anchorOffset);

  if (!targetLocation) {
    return null;
  }

  const targetXmlLocation = locateTargetXml(context, cluster.from, anchorOffset);

  return {
    commentIds: [item.order],
    groupId: undefined,
    status: 'resolved-by-sibling-pattern',
    commentOrder: item.order,
    commentId: item.id,
    requestedChange: {
      from: cluster.from,
      to: cluster.to,
    },
    targetXml: targetXmlLocation?.found ?? undefined,
    targetText: targetLocation.found,
    targetStartOffset: contextStart + targetLocation.startRel,
    targetEndOffset: contextStart + targetLocation.endRel,
    relatedItems: [item.order, ...cluster.orders],
    reason:
      `The bare-phrase comment ("${candidate.content}") matches the before-text of an in-file transformation ("${cluster.from}" to "${cluster.to}") confirmed by ${cluster.count} explicit sibling comments elsewhere in this same file. Auto-resolved via same-file sibling-pattern evidence, not a guess; requires glimpse confirmation before apply.`,
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

  if (request.bareCandidates && request.bareCandidates.length > 0) {
    const clusters = buildRequestedChangeClusters(request.requestedChanges);

    for (const candidate of request.bareCandidates) {
      const siblingResolution = resolveBareCandidateBySiblingPattern(
        request.xml,
        request.validation,
        candidate,
        clusters
      );

      if (siblingResolution) {
        resolutions.push(siblingResolution);
      }
    }
  }

  return resolutions;
}
