import { readFileSync } from 'node:fs';
import { runProductionPipeline } from '../services/agents/productionPipeline.js';

const XML_PATH =
  'C:\\Users\\Kevin\\Desktop\\FL-Xtools\\Sample Files\\Queried\\CEJ_182103\\s200\\CEJ_182103.xml';

async function main(): Promise<void> {
  const xml = readFileSync(XML_PATH, 'utf8');

  const result = await runProductionPipeline({
    xml,
    cleanAction: 'accept',
    qaInstruction: 'KB-001 bug reproduction: confirm sibling resolver dead in production pipeline.',
  });

  if ('error' in result.optChain) {
    console.log('OPT CHAIN FAILED:', result.optChain.error);
    process.exit(1);
  }

  const oc = result.optChain;

  // Tally decisions
  const actionCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  for (const d of oc.decisions) {
    actionCounts[d.decision] = (actionCounts[d.decision] ?? 0) + 1;
    statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1;
  }

  console.log('RESOLVER LENGTH (pipeline):', oc.resolutions.length);
  console.log('RESOLVER status breakdown (pipeline):', JSON.stringify(
    oc.resolutions.reduce((m: Record<string, number>, r) => {
      m[r.status] = (m[r.status] ?? 0) + 1;
      return m;
    }, {} as Record<string, number>)
  ));
  console.log('DECISIONS actions (pipeline):', JSON.stringify(actionCounts));
  console.log('DECISIONS statuses (pipeline):', JSON.stringify(statusCounts));

  // KB-001 test: is order=10 (bare-phrase Pr—Co sibling item) resolved?
  const order10Decision = oc.decisions.find((d: any) => d.order === 10);
  const order10Resolution = oc.resolutions.find((r: any) => r.commentOrder === 10);
  console.log('\n--- order=10 specific (KB-001 signature) ---');
  console.log('order10 resolution present:', !!order10Resolution);
  console.log('order10 resolution status:', order10Resolution?.status ?? '<NONE>');
  console.log('order10 decision:', order10Decision?.decision ?? '<NONE>');
  console.log('order10 requiresGlimpse:', order10Decision?.requiresGlimpse ?? '<NONE>');
  console.log('order10 decision.reason (first 240 chars):', String(order10Decision?.reason ?? '<NONE>').slice(0, 240));

  // Explicit verdict
  const pipelineHasSibling = oc.resolutions.some((r: any) => r.status === 'resolved-by-sibling-pattern');
  const pipelineApplyCount = actionCounts['apply'] ?? 0;
  const pipelineHumanReview = actionCounts['human-review'] ?? 0;
  console.log('\n=== KB-001 VERDICT (pipeline vs test harness) ===');
  console.log('Expected from test harness (testOptChain.ts):');
  console.log('  Resolver status: resolved:23, duplicate:2, resolved-by-sibling-pattern:1');
  console.log('  Decisions actions: apply:25, no-action:2, hold-for-jm:1');
  console.log('  order=10: status=resolved-by-sibling-pattern, decision=apply, glimpse=true');
  console.log('');
  console.log('Actual from production pipeline (runOptChain):');
  console.log('  Resolver length:', oc.resolutions.length);
  console.log('  Resolver statuses:', JSON.stringify(
    oc.resolutions.reduce((m: Record<string, number>, r) => {
      m[r.status] = (m[r.status] ?? 0) + 1;
      return m;
    }, {} as Record<string, number>)
  ));
  console.log('  Decisions actions:', JSON.stringify(actionCounts));
  console.log('  order=10 decision:', order10Decision?.decision, 'glimpse:', order10Decision?.requiresGlimpse);
  console.log('');
  if (!pipelineHasSibling && pipelineApplyCount === 24 && pipelineHumanReview === 1) {
    console.log('KB-001 CONFIRMED: sibling resolver is dead code in production pipeline.');
    console.log('  - No resolved-by-sibling-pattern status anywhere in pipeline resolutions');
    console.log('  - apply=24 (1 fewer than harness), human-review=1 (1 more than harness)');
    console.log('  - order=10 flipped back to human-review, requiresGlimpse=false (lost per-order evidence)');
    process.exit(2);
  } else if (pipelineHasSibling && pipelineApplyCount === 25 && pipelineHumanReview === 0) {
    console.log('KB-001 CLOSED: pipeline and harness agree.');
    process.exit(0);
  } else {
    console.log('KB-001 AMBIGUOUS: counts match neither bug-present nor bug-fixed signature.');
    console.log('Re-check input file and test harness version.');
    process.exit(3);
  }
}

main();
