/**
 * Keeper Executor
 *
 * The "Act" stage of the Agent loop (Understand -> Decide -> Act -> Verify -> React -> Report).
 *
 * C1 (Decide != Act) is enforced by construction: this module makes NO verdicts.
 * Every mutation is a mechanical consequence of a KeeperDecisionOutcome already
 * produced by keeperDecisionAgent.ts. If a decision's action doesn't map cleanly,
 * or the evidence needed to act is missing, the item is reported as an error and
 * the XML is left untouched there -- the executor never invents a decision.
 *
 * NOTE ON INPUT SHAPE: project-decision-brief.md § Priority 4 describes the executor
 * as consuming `{ xmlString, decisions }` only. In practice KeeperDecisionOutcome does
 * not carry the resolved replacement text, its position, or which OptValidatorItem(s)
 * it maps to -- that evidence lives in OptContextResolution / OptInterpretation /
 * OptValidatorItem. Acting on decisions alone would mean re-deriving or guessing
 * targets, which is exactly what this project's architecture exists to avoid. So this
 * module takes the full per-file chain output as read-only evidence, while
 * `decision.decision` remains the ONLY source of truth for what action to take.
 * Flagging this explicitly rather than silently narrowing the interface.
 *
 * REQUIRES: optContextResolver.ts to expose targetStartOffset / targetEndOffset on
 * OptContextResolution (absolute offsets into the full xml). See the accompanying
 * patch -- without it, comment-correction applies cannot safely locate their target.
 */

import type { OptValidatorItem, OptValidatorResult } from '../xml/optValidator.js';
import type { OptInterpretation } from './optInterpreter.js';
import type { OptContextResolution } from './optContextResolver.js';
import type { KeeperDecisionOutcome } from './keeperDecision.js';

export interface ExecutorRequest {
  xml: string;
  validation: OptValidatorResult;
  interpretations: OptInterpretation[];
  resolutions: OptContextResolution[];
  decisions: KeeperDecisionOutcome[];
}

export type ExecutorItemOutcome = 'applied' | 'skipped' | 'error';

export interface KeeperExecutionItemReport {
  order: number;
  decision: KeeperDecisionOutcome['decision'];
  outcome: ExecutorItemOutcome;
  detail: string;
}

export interface KeeperExecutionReport {
  items: KeeperExecutionItemReport[];
  counts: {
    applied: number;
    skipped: number;
    error: number;
    byDecision: Record<string, number>;
  };
}

export interface ExecutorResult {
  xml: string;
  report: KeeperExecutionReport;
}

interface PlannedEdit {
  order: number;
  start: number;
  end: number;
  replacement: string;
}

function buildItemsByOrder(items: OptValidatorItem[]): Map<number, OptValidatorItem> {
  const map = new Map<number, OptValidatorItem>();
  for (const item of items) {
    map.set(item.order, item);
  }
  return map;
}

function buildInterpretationsByPrimaryOrder(
  interpretations: OptInterpretation[]
): Map<number, OptInterpretation> {
  const map = new Map<number, OptInterpretation>();
  for (const interpretation of interpretations) {
    const primaryOrder = interpretation.relatedItems[0];
    if (primaryOrder !== undefined) {
      map.set(primaryOrder, interpretation);
    }
  }
  return map;
}

function buildResolutionsByCommentOrder(
  resolutions: OptContextResolution[]
): Map<number, OptContextResolution> {
  const map = new Map<number, OptContextResolution>();
  for (const resolution of resolutions) {
    map.set(resolution.commentOrder, resolution);
  }
  return map;
}

/**
 * Is this decision's primary item the DEL half of a DEL/INS replacement pair, per
 * the exact same gating condition keeperDecisionAgent.ts uses to route into
 * decideReplacementPair()? This is used ONLY to know which validator item(s) belong
 * to this one decision (the pair vs. a single comment) -- never to second-guess the
 * verdict itself.
 */
function isReplacementPairInterpretation(interpretation: OptInterpretation): boolean {
  return (
    interpretation.category === 'xml-correction' &&
    interpretation.action === 'apply-xml-change' &&
    !interpretation.requestedChange
  );
}

/**
 * Markup-level replacement for a single OPT item's raw tagged span, given the
 * decision applied to it. '' means "delete the whole tagged span". item.content
 * means "unwrap: keep the inner text, drop the opt_ tag". null means "no known
 * mutation for this combination" (caller reports it as an error, doesn't guess).
 */
function markupReplacementFor(
  item: OptValidatorItem,
  action: KeeperDecisionOutcome['decision']
): string | null {
  if (action === 'apply') {
    if (item.type === 'DEL') return ''; // deletion accepted -> original text goes away
    if (item.type === 'INS') return item.content; // insertion accepted -> unwrap, keep new text
    if (item.type === 'COMMENT') return ''; // instruction consumed -> strip the note entirely
    return null;
  }

  if (action === 'reject') {
    if (item.type === 'DEL') return item.content; // deletion rejected -> keep original text
    if (item.type === 'INS') return ''; // insertion rejected -> discard the proposed text
    if (item.type === 'COMMENT') return ''; // strip markup, per Priority 4 rule 2
    return null;
  }

  if (action === 'no-action') {
    // EXPLICIT DECISION (Priority 4 rule 2 leaves this TBD): strip the OPT markup,
    // leave any nearby manuscript text completely untouched. The only no-action
    // items produced so far are duplicate comments -- the underlying text was
    // already handled by the sibling decision that IS an apply, so this tag is a
    // now-redundant instruction with no manuscript text of its own to preserve.
    return '';
  }

  // hold-for-jm / human-review: never reach here -- caller skips before this point.
  return null;
}

function planEditsForDecision(
  decision: KeeperDecisionOutcome,
  interpretation: OptInterpretation,
  resolution: OptContextResolution | undefined,
  itemsByOrder: Map<number, OptValidatorItem>
): { edits: PlannedEdit[]; detail: string } | { error: string } {
  const isPair = isReplacementPairInterpretation(interpretation);

  // Which validator items does THIS decision own? For a DEL/INS pair, both members
  // of relatedItems are two tags mutated together as one edit. For everything else,
  // relatedItems may include OTHER comments' orders (sibling-pattern evidence, or
  // the earlier comment in a duplicate pair) that have their OWN separate decisions
  // -- only decision.order itself belongs to this decision.
  const ownedOrders = isPair ? decision.relatedItems : [decision.order];

  const edits: PlannedEdit[] = [];
  const detailParts: string[] = [];

  for (const order of ownedOrders) {
    const item = itemsByOrder.get(order);

    if (!item) {
      return { error: `No validator item found for order ${order}.` };
    }

    const replacement = markupReplacementFor(item, decision.decision);

    if (replacement === null) {
      return {
        error: `No known markup mutation for item type "${item.type}" under decision "${decision.decision}".`,
      };
    }

    edits.push({ order: decision.order, start: item.startOffset, end: item.endOffset, replacement });
    detailParts.push(`${item.type}[order ${order}] markup ${replacement === '' ? 'stripped' : 'unwrapped'}`);
  }

  // Comment corrections (apply only): also swap the resolved target text in the
  // manuscript body, using the ABSOLUTE offsets the Resolver returns.
  if (
    decision.decision === 'apply' &&
    !isPair &&
    resolution &&
    (resolution.status === 'resolved' || resolution.status === 'resolved-by-sibling-pattern')
  ) {
    if (
      resolution.targetStartOffset === undefined ||
      resolution.targetEndOffset === undefined ||
      !resolution.requestedChange
    ) {
      return {
        error:
          'Resolution is missing targetStartOffset/targetEndOffset or requestedChange.to -- cannot safely apply without a literal position. Apply the optContextResolver.ts offset patch first.',
      };
    }

    const commentSpan = edits.find((edit) => edit.order === decision.order);
    const overlapsCommentTag =
      commentSpan !== undefined &&
      resolution.targetStartOffset < commentSpan.end &&
      resolution.targetEndOffset > commentSpan.start;

    if (overlapsCommentTag) {
      return {
        error: "Resolved target span overlaps the OPT_COMMENT tag's own span -- refusing to guess, needs human review.",
      };
    }

    edits.push({
      order: decision.order,
      start: resolution.targetStartOffset,
      end: resolution.targetEndOffset,
      replacement: resolution.requestedChange.to,
    });

    detailParts.push(
      `target text replaced ("${resolution.requestedChange.from}" -> "${resolution.requestedChange.to}")`
    );
  }

  return { edits, detail: detailParts.join('; ') };
}

function applyEditsToXml(xml: string, edits: PlannedEdit[]): string {
  // Apply from the end of the document backward so earlier offsets stay valid.
  const sorted = [...edits].sort((a, b) => b.start - a.start);

  let result = xml;

  for (const edit of sorted) {
    result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
  }

  return result;
}

export function executeKeeperDecisions(request: ExecutorRequest): ExecutorResult {
  const itemsByOrder = buildItemsByOrder(request.validation.items);
  const interpretationsByOrder = buildInterpretationsByPrimaryOrder(request.interpretations);
  const resolutionsByOrder = buildResolutionsByCommentOrder(request.resolutions);

  const itemReports: KeeperExecutionItemReport[] = [];
  const acceptedEdits: PlannedEdit[] = [];
  const claimedSpans: Array<{ start: number; end: number; order: number }> = [];

  for (const decision of request.decisions) {
    if (decision.decision === 'hold-for-jm' || decision.decision === 'human-review') {
      itemReports.push({
        order: decision.order,
        decision: decision.decision,
        outcome: 'skipped',
        detail: 'No mutation permitted for this decision type; XML left exactly as-is.',
      });
      continue;
    }

    const interpretation = interpretationsByOrder.get(decision.order);

    if (!interpretation) {
      itemReports.push({
        order: decision.order,
        decision: decision.decision,
        outcome: 'error',
        detail: `No interpretation found with relatedItems[0] === ${decision.order}.`,
      });
      continue;
    }

    const resolution = resolutionsByOrder.get(decision.order);
    const planned = planEditsForDecision(decision, interpretation, resolution, itemsByOrder);

    if ('error' in planned) {
      itemReports.push({ order: decision.order, decision: decision.decision, outcome: 'error', detail: planned.error });
      continue;
    }

    let conflict: { candidate: PlannedEdit; claimed: { start: number; end: number; order: number } } | undefined;

    for (const candidate of planned.edits) {
      const claimed = claimedSpans.find(
        (existing) => candidate.start < existing.end && candidate.end > existing.start
      );
      if (claimed) {
        conflict = { candidate, claimed };
        break;
      }
    }

    if (conflict) {
      itemReports.push({
        order: decision.order,
        decision: decision.decision,
        outcome: 'error',
        detail: `Planned edit span [${conflict.candidate.start}, ${conflict.candidate.end}) overlaps already-accepted edit from order ${conflict.claimed.order} at [${conflict.claimed.start}, ${conflict.claimed.end}); refusing to guess ordering.`,
      });
      continue;
    }

    for (const edit of planned.edits) {
      claimedSpans.push({ start: edit.start, end: edit.end, order: decision.order });
    }

    acceptedEdits.push(...planned.edits);

    itemReports.push({
      order: decision.order,
      decision: decision.decision,
      outcome: 'applied',
      detail: planned.detail || 'Mutation applied.',
    });
  }

  const newXml = applyEditsToXml(request.xml, acceptedEdits);

  const counts = {
    applied: 0,
    skipped: 0,
    error: 0,
    byDecision: {} as Record<string, number>,
  };

  for (const report of itemReports) {
    counts[report.outcome] += 1;
    counts.byDecision[report.decision] = (counts.byDecision[report.decision] ?? 0) + 1;
  }

  return { xml: newXml, report: { items: itemReports, counts } };
}
