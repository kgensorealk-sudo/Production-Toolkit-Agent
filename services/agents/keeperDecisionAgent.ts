/**
 * Keeper Decision Agent
 *
 * Decision logic that consumes OPT Interpreter and Context Resolver
 * output and produces a KeeperDecisionOutcome per OPT item.
 *
 * This only covers the real, evidence-backed patterns seen so far:
 *   - DEL/INS replacement pairs (shared nested ID)
 *   - Single "please change X to Y" comment corrections
 *   - Bare-phrase comments resolved via same-file sibling-pattern evidence
 *     (Strategy A1) -- routed the same as explicit corrections once the
 *     Resolver has supplied a resolution, since the Resolver is the only
 *     layer allowed to know how a bare phrase got its requestedChange.
 *
 * Anything outside these known patterns falls through to
 * human-review rather than being guessed at.
 */

import type { OptInterpretation } from './optInterpreter.js';
import type { OptContextResolution } from './optContextResolver.js';
import type {
  KeeperDecisionOutcome,
  KeeperDecisionAction,
  KeeperDecisionStatus
} from './keeperDecision.js';

export interface KeeperDecisionRequest {
  interpretation: OptInterpretation;
  resolution?: OptContextResolution;
}

function decideReplacementPair(
  interpretation: OptInterpretation
): KeeperDecisionOutcome {
  return {
    order: interpretation.relatedItems[0],
    commentIds: [interpretation.relatedItems[0]],
    groupId: undefined,
    decision: 'apply',
    status: 'ready',
    confidence: interpretation.confidence,
    reason: interpretation.finding,
    requiresJmQuery: false,
    requiresGlimpse: true,
    relatedItems: interpretation.relatedItems
  };
}

function decideCommentCorrection(
  interpretation: OptInterpretation,
  resolution: OptContextResolution
): KeeperDecisionOutcome {
  const order = resolution.commentOrder;
  const relatedItems = resolution.relatedItems.length > 0
    ? resolution.relatedItems
    : interpretation.relatedItems;

  switch (resolution.status) {
    case 'resolved':
    case 'resolved-by-sibling-pattern':
      return {
        order,
        commentIds: [order],
        groupId: undefined,
        decision: 'apply',
        status: 'ready',
        confidence: interpretation.confidence,
        reason: resolution.reason,
        requiresJmQuery: false,
        requiresGlimpse: true,
        relatedItems
      };

    case 'duplicate':
      return {
        order,
        commentIds: [order],
        groupId: undefined,
        decision: 'no-action',
        status: 'blocked',
        confidence: interpretation.confidence,
        reason: resolution.reason,
        requiresJmQuery: false,
        requiresGlimpse: false,
        relatedItems
      };

    case 'ambiguous':
    case 'unresolved':
    default:
      return {
        order,
        commentIds: [order],
        groupId: undefined,
        decision: 'human-review',
        status:
          resolution.status === 'ambiguous' ? 'ambiguous' : 'unresolved',
        confidence: interpretation.confidence,
        reason: resolution.reason,
        requiresJmQuery: false,
        requiresGlimpse: false,
        relatedItems
      };
  }
}

function decideSupplementaryOrExternalChange(
  interpretation: OptInterpretation
): KeeperDecisionOutcome {
  return {
    order: interpretation.relatedItems[0],
    commentIds: [interpretation.relatedItems[0]],
    groupId: undefined,
    decision: 'hold-for-jm',
    status: 'blocked',
    confidence: interpretation.confidence,
    reason: interpretation.finding,
    requiresJmQuery: true,
    requiresGlimpse: false,
    relatedItems: interpretation.relatedItems
  };
}

function decideFallback(
  interpretation: OptInterpretation
): KeeperDecisionOutcome {
  return {
    order: interpretation.relatedItems[0] ?? -1,
    commentIds: [interpretation.relatedItems[0] ?? -1],
    groupId: undefined,
    decision: 'human-review',
    status: 'unresolved',
    confidence: interpretation.confidence,
    reason:
      'This OPT item does not match a known decision pattern and requires human review.',
    requiresJmQuery: false,
    requiresGlimpse: false,
    relatedItems: interpretation.relatedItems
  };
}

export function decideOptItem(
  request: KeeperDecisionRequest
): KeeperDecisionOutcome {
  const { interpretation, resolution } = request;

  if (
    interpretation.category === 'xml-correction' &&
    interpretation.action === 'apply-xml-change' &&
    !interpretation.requestedChange
  ) {
    return decideReplacementPair(interpretation);
  }

  if (
    interpretation.category === 'xml-correction' &&
    interpretation.action === 'human-review' &&
    resolution
  ) {
    return decideCommentCorrection(interpretation, resolution);
  }

  if (interpretation.category === 'external-file-change') {
    return decideSupplementaryOrExternalChange(interpretation);
  }

  return decideFallback(interpretation);
}
