/**
 * Keeper Decision Log (Strategy C2)
 *
 * Persistent, append-only record of what the chain decided and (eventually) what a
 * human did about it. Local JSONL per session, gitignored, no user-identifiable data
 * -- just text pairs and signals. Required before any Strategy B/C work: the learning
 * batch tool (C3) and the LLM shadow-gate (Strategy B) both read this log, they don't
 * write chain logic against it directly.
 *
 * This module does NOT decide anything and does NOT mutate XML -- same C1 boundary
 * as everywhere else in this chain. It only persists what the Decision/Executor
 * stages already produced.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { KeeperDecisionAction, KeeperDecisionStatus } from '../agents/keeperDecision.js';
import type { OptContextResolution } from '../agents/optContextResolver.js';

export type KeeperEvidenceSource =
  | 'resolver'
  | 'sibling-pattern'
  | 'codebook'
  | 'llm-validated'
  | 'human-fixed';

export type KeeperHumanOutcome =
  | 'confirmed-apply'
  | 'rejected-apply'
  | 'fixed-manually'
  | 'n/a';

export interface KeeperLoggedDecision {
  sessionId: string;
  fileHash: string;
  commentOrder: number;
  commentTextNorm: string;
  evidenceSource: KeeperEvidenceSource;
  decision: KeeperDecisionAction;
  decisionStatus: KeeperDecisionStatus;
  resolvedPair?: { from: string; to: string };
  ruleId?: string;
  siblingClusterSize?: number;
  humanOutcome?: KeeperHumanOutcome;
  humanFixedPair?: { from: string; to: string };
  llmRationaleForAuditOnly?: string;
  timestamp: string;
}

const LOG_DIR = path.resolve(process.cwd(), 'learning-log');

function logFilePathForSession(sessionId: string): string {
  // Defensive: sessionId ends up as a filename, never trust it verbatim.
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(LOG_DIR, `${safeId}.jsonl`);
}

/**
 * Best-effort mapping from a Resolver outcome to an evidenceSource tag. Only covers
 * the sources this chain can currently produce (resolver, sibling-pattern); codebook /
 * llm-validated / human-fixed are set explicitly by their own future callers (Strategy
 * A2, Strategy B, and the UI respectively), not derived here.
 */
export function evidenceSourceFromResolution(
  resolution: OptContextResolution | undefined
): KeeperEvidenceSource {
  if (resolution?.status === 'resolved-by-sibling-pattern') {
    return 'sibling-pattern';
  }
  return 'resolver';
}

export async function appendDecisionLogEntry(entry: KeeperLoggedDecision): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true });
  const line = JSON.stringify(entry) + '\n';
  await fs.appendFile(logFilePathForSession(entry.sessionId), line, { encoding: 'utf8' });
}

export async function appendDecisionLogEntries(entries: KeeperLoggedDecision[]): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  await fs.mkdir(LOG_DIR, { recursive: true });

  const bySession = new Map<string, KeeperLoggedDecision[]>();

  for (const entry of entries) {
    const existing = bySession.get(entry.sessionId);
    if (existing) {
      existing.push(entry);
    } else {
      bySession.set(entry.sessionId, [entry]);
    }
  }

  for (const [sessionId, sessionEntries] of bySession) {
    const lines = sessionEntries.map((entry) => JSON.stringify(entry)).join('\n') + '\n';
    await fs.appendFile(logFilePathForSession(sessionId), lines, { encoding: 'utf8' });
  }
}

export async function readSessionLog(sessionId: string): Promise<KeeperLoggedDecision[]> {
  try {
    const raw = await fs.readFile(logFilePathForSession(sessionId), 'utf8');
    return raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as KeeperLoggedDecision);
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function listLoggedSessionIds(): Promise<string[]> {
  try {
    const files = await fs.readdir(LOG_DIR);
    return files.filter((file) => file.endsWith('.jsonl')).map((file) => file.slice(0, -'.jsonl'.length));
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}
