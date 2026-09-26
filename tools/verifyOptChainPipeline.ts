import { readFileSync } from 'node:fs';
import { runProductionPipeline } from '../services/agents/productionPipeline.js';

const XML_PATH =
  'C:\\Users\\Kevin\\Desktop\\FL-Xtools\\Sample Files\\Queried\\CEJ_182103\\s200\\CEJ_182103.xml';

async function main(): Promise<void> {
  const xml = readFileSync(XML_PATH, 'utf8');

  const result = await runProductionPipeline({
    xml,
    cleanAction: 'accept',
    qaInstruction: 'Verify OPT chain wiring (OPT chain / productionPipeline regression check).',
  });

  if ('error' in result.optChain) {
    console.log('OPT CHAIN FAILED:', result.optChain.error);
    process.exit(1);
  }

  console.log('cleanedXml length:', result.cleanedXml.length);
  console.log('cleanedXml contains any opt_ tag:', /<opt_/i.test(result.cleanedXml));
  console.log('---');
  console.log('optChain.validation.total:', result.optChain.validation.total);
  console.log('optChain.validation.detected:', result.optChain.validation.detected);
  console.log('optChain.interpretation.total:', result.optChain.interpretation.total);
  console.log('optChain.resolutions.length:', result.optChain.resolutions.length);
  console.log('optChain.decisions.length:', result.optChain.decisions.length);

  const expected = 29;
  if (result.optChain.validation.total === expected) {
    console.log(`PASS: validation.total === ${expected}`);
  } else {
    console.log(`FAIL: expected ${expected}, got ${result.optChain.validation.total}`);
    process.exit(1);
  }
}

main();
