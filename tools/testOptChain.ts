/**
 * tools/testOptChain.ts
 *
 * Manual diagnostic script — NOT part of the production pipeline.
 *
 * Runs a real production XML file through the full OPT chain:
 *   Validator -> Interpreter -> Context Resolver -> Keeper Decision
 *
 * Prints a per-item summary and final tallies so we can see the true
 * end-to-end picture, now that the Interpreter no longer silently
 * drops unmatched comments (see db00eb5).
 *
 * Usage:
 *   npx tsx tools/testOptChain.ts
 */

import { readFileSync } from 'node:fs';
import { validateOptMarkup } from '../services/xml/optValidator.js';
import { interpretOptMarkup } from '../services/agents/optInterpreter.js';
import { resolveOptCommentContext } from '../services/agents/optContextResolver.js';
import type { OptContextResolution } from '../services/agents/optContextResolver.js';
import { decideOptItem } from '../services/agents/keeperDecisionAgent.js';

const XML_PATH =
  'C:\\Users\\Kevin\\Desktop\\FL-Xtools\\Sample Files\\Queried\\CEJ_182103\\s200\\CEJ_182103.xml';

function main(): void {
  const xml = readFileSync(XML_PATH, 'utf8');

  const validation = validateOptMarkup(xml);

  console.log('='.repeat(80));
  console.log('STAGE 1: VALIDATOR');
  console.log('='.repeat(80));
  console.log(`detected: ${validation.detected}`);
  console.log(`total items: ${validation.total}`);
  const typeCounts: Record<string, number> = {};
  for (const item of validation.items) {
    typeCounts[item.type] = (typeCounts[item.type] ?? 0) + 1;
  }
  console.log('by type:', typeCounts);
  if (validation.warnings.length > 0) {
    console.log('warnings:');
    for (const w of validation.warnings) console.log(`  - ${w}`);
  }

  const interpretation = interpretOptMarkup({ validation });

  console.log('\n' + '='.repeat(80));
  console.log('STAGE 2: INTERPRETER');
  console.log('='.repeat(80));
  console.log(`detected: ${interpretation.detected}`);
  console.log(`interpretations produced: ${interpretation.interpretations.length}`);
  const categoryCounts: Record<string, number> = {};
  for (const interp of interpretation.interpretations) {
    categoryCounts[interp.category] = (categoryCounts[interp.category] ?? 0) + 1;
  }
  console.log('by category:', categoryCounts);

  const requestedChanges = interpretation.interpretations
    .filter((interp) => interp.category === 'xml-correction' && interp.requestedChange)
    .map((interp) => ({
      order: interp.relatedItems[0],
      from: interp.requestedChange!.from,
      to: interp.requestedChange!.to,
    }));

  console.log('\n' + '='.repeat(80));
  console.log('STAGE 3: CONTEXT RESOLVER');
  console.log('='.repeat(80));
  console.log(`requestedChanges to resolve: ${requestedChanges.length}`);

  const resolutions = resolveOptCommentContext({
    xml,
    validation,
    requestedChanges,
  });

  const resolutionByOrder = new Map<number, OptContextResolution>();
  for (const r of resolutions) {
    resolutionByOrder.set(r.commentOrder, r);
  }

  const statusCounts: Record<string, number> = {};
  for (const r of resolutions) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }
  console.log('by status:', statusCounts);

  console.log('\n' + '='.repeat(80));
  console.log('STAGE 4: KEEPER DECISION — per-item summary');
  console.log('='.repeat(80));

  const header = [
    'order'.padEnd(6),
    'category'.padEnd(20),
    'resolverStatus'.padEnd(15),
    'decision'.padEnd(13),
    'jmQuery'.padEnd(8),
    'glimpse'.padEnd(8),
    'reason',
  ].join(' | ');
  console.log(header);
  console.log('-'.repeat(header.length + 40));

  const decisionCounts: Record<string, number> = {};
  const decisionStatusCounts: Record<string, number> = {};

  for (const interp of interpretation.interpretations) {
    const order = interp.relatedItems[0];
    const resolution = interp.requestedChange
      ? resolutionByOrder.get(order)
      : undefined;

    const outcome = decideOptItem({ interpretation: interp, resolution });

    decisionCounts[outcome.decision] = (decisionCounts[outcome.decision] ?? 0) + 1;
    decisionStatusCounts[outcome.status] = (decisionStatusCounts[outcome.status] ?? 0) + 1;

    const row = [
      String(outcome.order).padEnd(6),
      interp.category.padEnd(20),
      (resolution?.status ?? 'n/a').padEnd(15),
      outcome.decision.padEnd(13),
      String(outcome.requiresJmQuery).padEnd(8),
      String(outcome.requiresGlimpse).padEnd(8),
      outcome.reason.slice(0, 100),
    ].join(' | ');
    console.log(row);
  }

  console.log('\n' + '='.repeat(80));
  console.log('FINAL TALLIES');
  console.log('='.repeat(80));
  console.log(`Validator total items: ${validation.total} (${JSON.stringify(typeCounts)})`);
  console.log(`Interpreter interpretations: ${interpretation.interpretations.length} (${JSON.stringify(categoryCounts)})`);
  console.log(`Resolver resolutions: ${resolutions.length} (${JSON.stringify(statusCounts)})`);
  console.log(`Decisions by action: ${JSON.stringify(decisionCounts)}`);
  console.log(`Decisions by status: ${JSON.stringify(decisionStatusCounts)}`);
}

main();