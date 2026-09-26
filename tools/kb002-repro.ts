/**
 * tools/kb002-repro.ts
 *
 * Manual reproduction / verification script for KB-002 -- NOT part of the
 * production pipeline.
 *
 * Builds a synthetic XML string with a near-backward occurrence and a
 * far-forward occurrence of the same target text, both inside the
 * Resolver's 2000-back/500-forward window, and confirms locateRequestedTarget
 * picks the NEAREST occurrence to the OPT_COMMENT anchor rather than
 * whichever occurrence is textually last in the search string.
 *
 * This is the scenario A3 (2000/500 window) actually created: a forward
 * occurrence always has a higher string index than any backward occurrence,
 * so lastIndexOf would wrongly prefer a distant forward match over a close
 * backward one. (Note: the bug register's own illustrative two-BACKWARD-
 * occurrence example does not appear to reproduce the bug -- for two purely
 * backward occurrences, lastIndexOf already returns the nearer one, since
 * "nearer to anchor" = "later in the string" = higher index for backward-only
 * matches. The real failure mode is backward-vs-forward, tested here.)
 *
 * Usage:
 *   npx tsx tools/kb002-repro.ts
 */

import { resolveOptCommentContext } from '../services/agents/optContextResolver.js';
import type { OptValidatorResult, OptValidatorItem } from '../services/xml/optValidator.js';

const NEAR_BACK_GAP = 50;
const FAR_FWD_GAP = 400;

const before = 'x'.repeat(20) + 'OLDTEXT' + 'y'.repeat(NEAR_BACK_GAP);
const commentTag = '<opt_COMMENT id="c1">please change "OLDTEXT" to "NEWTEXT"</opt_COMMENT>';
const after = 'z'.repeat(FAR_FWD_GAP) + 'OLDTEXT' + 'w'.repeat(20);

const xml = before + commentTag + after;
const commentStart = before.length;
const commentEnd = commentStart + commentTag.length;

const item: OptValidatorItem = {
  order: 1,
  type: 'COMMENT',
  tagName: 'opt_COMMENT',
  id: 'c1',
  attributes: { id: 'c1' },
  content: 'please change "OLDTEXT" to "NEWTEXT"',
  raw: commentTag,
  startOffset: commentStart,
  endOffset: commentEnd,
  nestedElements: [],
  ids: [],
  refids: [],
  form: 'paired',
};

const validation: OptValidatorResult = {
  detected: true,
  total: 1,
  items: [item],
  warnings: [],
};

const resolutions = resolveOptCommentContext({
  xml,
  validation,
  requestedChanges: [{ order: 1, from: 'OLDTEXT', to: 'NEWTEXT' }],
});

const resolution = resolutions[0];

console.log('='.repeat(80));
console.log('KB-002 SYNTHETIC REPRODUCTION');
console.log('='.repeat(80));
console.log(`Backward occurrence: ~${NEAR_BACK_GAP} chars before anchor`);
console.log(`Forward occurrence:  ~${FAR_FWD_GAP} chars after anchor`);
console.log('');
console.log('status:', resolution.status);
console.log('reason:', resolution.reason);

const distanceMatch = resolution.reason.match(/~(\d+) chars/);
const reportedDistance = distanceMatch ? parseInt(distanceMatch[1], 10) : -1;

console.log('');
console.log('reported distance from anchor:', reportedDistance);

if (resolution.status === 'resolved' && reportedDistance >= 0 && reportedDistance < FAR_FWD_GAP) {
  console.log('');
  console.log('KB-002 VERIFIED: nearest (backward) occurrence selected over the farther forward one.');
  process.exit(0);
} else {
  console.log('');
  console.log('KB-002 FAILED: did not select the nearest occurrence.');
  console.log('Full resolution:', JSON.stringify(resolution, null, 2));
  process.exit(2);
}