/**
 * tools/debugResolutions.ts
 *
 * One-off diagnostic -- NOT part of the production pipeline, not meant to be kept.
 *
 * Prints, for a specific set of comment orders, the resolved requestedChange,
 * the absolute targetStartOffset/targetEndOffset the Resolver computed, and a
 * window of the ORIGINAL (pre-executor) xml around that offset -- so we can see
 * exactly where a given correction landed, rather than grepping for the
 * replacement string across the whole document (which is ambiguous whenever
 * that string legitimately occurs elsewhere).
 *
 * Usage:
 *   npx tsx tools/debugResolutions.ts
 */

import { readFileSync } from 'node:fs';
import { validateOptMarkup } from '../services/xml/optValidator.js';
import { interpretOptMarkup } from '../services/agents/optInterpreter.js';
import { resolveOptCommentContext } from '../services/agents/optContextResolver.js';

const XML_PATH =
  'C:\\Users\\Kevin\\Desktop\\FL-Xtools\\Sample Files\\Queried\\CEJ_182103\\s200\\CEJ_182103.xml';

const ORDERS_TO_INSPECT = [13, 24, 26];

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

  for (const order of ORDERS_TO_INSPECT) {
    const resolution = resolutions.find((r) => r.commentOrder === order);

    console.log('='.repeat(80));
    console.log(`ORDER ${order}`);
    console.log('='.repeat(80));

    if (!resolution) {
      console.log('No resolution found for this order.');
      continue;
    }

    console.log(`status: ${resolution.status}`);
    console.log(`requestedChange: ${JSON.stringify(resolution.requestedChange)}`);
    console.log(`targetStartOffset: ${resolution.targetStartOffset}`);
    console.log(`targetEndOffset: ${resolution.targetEndOffset}`);
    console.log(`targetText (matched, normalized): ${JSON.stringify(resolution.targetText)}`);

    if (resolution.targetStartOffset === undefined || resolution.targetEndOffset === undefined) {
      console.log('(no offsets to show context for)');
      continue;
    }

    const windowStart = Math.max(0, resolution.targetStartOffset - 80);
    const windowEnd = Math.min(xml.length, resolution.targetEndOffset + 80);

    console.log('--- ORIGINAL xml around target span (raw, pre-executor) ---');
    console.log(xml.slice(windowStart, windowEnd));

    console.log('--- exact raw slice at [targetStartOffset, targetEndOffset) ---');
    console.log(JSON.stringify(xml.slice(resolution.targetStartOffset, resolution.targetEndOffset)));
  }
}

main();
