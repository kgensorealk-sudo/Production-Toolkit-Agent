/**
 * tools/testCleaner.ts
 *
 * Manual diagnostic script -- NOT part of the production pipeline.
 *
 * Runs the updated cleanXmlTags() (with the new unconditional XML-comment
 * strip) against the Executor's output, and writes the result so we can
 * inspect it and re-run VTOOL against something closer to a real
 * "final submission" candidate.
 *
 * Usage:
 *   npx tsx tools/testCleaner.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { cleanXmlTags } from '../services/xml/xmlTagCleaner.js';

const INPUT_PATH = 'tools\\output\\CEJ_182103.executed.xml';
const OUTPUT_PATH = 'tools\\output\\CEJ_182103.final.xml';

function main(): void {
  const xml = readFileSync(INPUT_PATH, 'utf8');

  // Mode is 'accept' but shouldn't matter here -- the Executor already
  // resolved every opt_INS/opt_DEL, so none should remain for cleanXmlTags
  // to act on. Only the new unconditional XML-comment strip should fire.
  const result = cleanXmlTags(xml, 'accept');

  console.log('='.repeat(80));
  console.log('XML TAG CLEANER REPORT');
  console.log('='.repeat(80));
  console.log(`changed: ${result.changed}`);
  console.log(`report items: ${result.report.length}`);

  for (const item of result.report) {
    console.log(`  [${item.id}] type=${item.type} action=${item.action} content=${JSON.stringify(item.content.slice(0, 80))}`);
  }

  writeFileSync(OUTPUT_PATH, result.output, { encoding: 'utf8' });
  console.log(`\nCleaned XML written to: ${OUTPUT_PATH}`);
  console.log(`Input length: ${xml.length}, Output length: ${result.output.length}`);
}

main();
