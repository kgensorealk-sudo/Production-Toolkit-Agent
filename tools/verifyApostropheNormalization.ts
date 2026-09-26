import { analyzeProductionIssue } from '../services/agents/productionQaAgent.js';

function check(label: string, input: string, expectStatus: string, expectJmQuery: boolean): void {
  const result = analyzeProductionIssue({ input });
  const statusOk = result.status === expectStatus;
  const jmOk = result.jmQueryRequired === expectJmQuery;
  const pass = statusOk && jmOk;
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${label}`);
  console.log(`  input: "${input}"`);
  console.log(`  status: ${result.status} (expected ${expectStatus}) ${statusOk ? '' : '<-- MISMATCH'}`);
  console.log(`  jmQueryRequired: ${result.jmQueryRequired} (expected ${expectJmQuery}) ${jmOk ? '' : '<-- MISMATCH'}`);
  if (!pass) process.exitCode = 1;
}

// Straight ASCII apostrophe -- this is the case that was previously silently
// missed, since the signal array only had the curly-quote variant.
check(
  'straight apostrophe (the bug case)',
  'The affiliation ID doesn\'t match what the author requested in the production notes.',
  'conflict',
  true
);

// Curly apostrophe -- must still work after normalization (regression check
// against the original working case, not just the fixed one).
check(
  'curly apostrophe (must still work)',
  'The affiliation ID doesn\u2019t match what the author requested in the production notes.',
  'conflict',
  true
);
