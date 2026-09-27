/**
 * Keeper Decision
 *
 * Shared decision contract between the OPT reasoning chain
 * (Validator -> Interpreter -> Context Resolver) and the
 * eventual Keeper Decision logic and non-destructive XML executor.
 *
 * This file defines the contract only. No decision logic yet.
 */

export type KeeperDecisionAction =
  | 'apply'
  | 'reject'
  | 'hold-for-jm'
  | 'human-review'
  | 'no-action';

export type KeeperDecisionStatus =
  | 'ready'
  | 'blocked'
  | 'ambiguous'
  | 'unresolved';

export interface KeeperDecisionOutcome {
  order: number;                  // legacy: always === commentIds[0] for non-grouped; deprecated 1 release
  commentIds: number[];             // required, 1-element for non-grouped, N-element for grouped
  groupId?: string | null;          // Grouping doc groupId, or null/undefined if not grouped
  decision: KeeperDecisionAction;
  status: KeeperDecisionStatus;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  requiresJmQuery: boolean;
  requiresGlimpse: boolean;
  relatedItems: number[];
}

