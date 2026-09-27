/**
 * tools/testExecutor.ts
 *
 * Manual diagnostic script -- NOT part of the production pipeline.
 *
 * Same orchestration as tools/testOptChain.ts (Validator -> Interpreter ->
 * Context Resolver -> Keeper Decision), plus a new Stage 5: runs the result
 * through executeKeeperDecisions() and writes the mutated XML to disk so it
 * can be inspected by eye before anything is wired into productionPipeline.ts.
 *
 * Usage:
 *   npx tsx tools/testExecutor.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { validateOptMarkup } from '../services/xml/optValidator.js';
import { interpretOptMarkup } from '../services/agents/optInterpreter.js';
import { resolveOptCommentContext } from '../services/agents/optContextResolver.js';
import type { OptContextResolution } from '../services/agents/optContextResolver.js';
import { decideOptItem } from '../services/agents/keeperDecisionAgent.js';
import { executeKeeperDecisions } from '../services/agents/executor.js';

const XML_PATH =
  'C:\\Users\\Kevin\\Desktop\\FL-Xtools\\Sample Files\\Queried\\CEJ_182103\\s200\\CEJ_182103.xml';
const OUTPUT_PATH = 'tools\\output\\CEJ_182103.executed.xml';

function main(): void {
  const xml = readFileSync(XML_PATH, 'utf8');
  const validation = validateOptMarkup(xml);
  const interpretation = interpretOptMarkup({ validation });

  const requestedChanges = interpretation.interpretations
    .filter((interp) => interp.category === 'xml-correction' && interp.requestedChange)
    .map((interp) => ({
      order: interp.relatedItems[0],
      from: interp.requestedChange!.from,
      to: interp.requestedChange!.to,
    }));

  const bareCandidates = interpretation.interpretations
    .filter(
      (interp) =>
        interp.category === 'xml-correction' &&
        interp.action === 'human-review' &&
        !interp.requestedChange
    )
    .map((interp) => {
      const order = interp.relatedItems[0];
      const item = validation.items.find((candidate) => candidate.order === order);
      return item ? { order, content: item.content } : null;
    })
    .filter((candidate): candidate is { order: number; content: string } => candidate !== null);

  const resolutions = resolveOptCommentContext({ xml, validation, requestedChanges, bareCandidates });

  const resolutionByOrder = new Map<number, OptContextResolution>();
  for (const r of resolutions) {
    resolutionByOrder.set(r.commentOrder, r);
  }

  const decisions = interpretation.interpretations.map((interp) => {
    const order = interp.relatedItems[0];
    const resolution = resolutionByOrder.get(order);
    return decideOptItem({ interpretation: interp, resolution });
  });

  console.log('='.repeat(80));
  console.log('STAGE 5: EXECUTOR');
  console.log('='.repeat(80));

  const result = executeKeeperDecisions({
    xml,
    validation,
    interpretations: interpretation.interpretations,
    resolutions,
    decisions,
  });

  const header = ['order'.padEnd(6), 'decision'.padEnd(13), 'outcome'.padEnd(9), 'detail'].join(' | ');
  console.log(header);
  console.log('-'.repeat(header.length + 60));

  for (const item of result.report.items) {
    const row = [
      String(item.order).padEnd(6),
      item.decision.padEnd(13),
      item.outcome.padEnd(9),
      item.detail.slice(0, 120),
    ].join(' | ');
    console.log(row);
  }

  console.log('\nCounts:', JSON.stringify(result.report.counts));

  mkdirSync('tools\\output', { recursive: true });
  // BOM-less: Node's default utf8 write does not prepend a BOM (unlike
  // PowerShell Set-Content -Encoding utf8), so no explicit encoding object
  // is needed here -- unlike the PowerShell-side writes elsewhere in this project.
  writeFileSync(OUTPUT_PATH, result.xml, { encoding: 'utf8' });

  console.log(`\nExecuted XML written to: ${OUTPUT_PATH}`);
  console.log(`Original length: ${xml.length}, New length: ${result.xml.length}`);
}

main();
