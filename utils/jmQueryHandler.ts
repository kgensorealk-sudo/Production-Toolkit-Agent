import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  callChatWithHistory,
  hasAnyLlmProvider,
  ChatMessage,
  LlmCandidate,
} from '../services/ai/llmSdk.js';

const JM_QUERY_CANDIDATES: LlmCandidate[] = [
  { provider: 'gemini', model: 'gemini-3.8-flash' },
  { provider: 'gemini', model: 'gemini-3-flash-preview' },
  { provider: 'gemini', model: 'gemini-3.7-flash' },
  { provider: 'gemini', model: 'gemini-3.1-flash-lite' },
  { provider: 'openai', model: 'gpt-4o-mini' },
  { provider: 'openai', model: 'gpt-4o' },
];

const JM_QUERY_SYSTEM_INSTRUCTION = `You are an expert Journal Production Editor.
Your task is to transform raw production notes, author comments, or artwork/metadata issues into formal, standardized TO THE JM queries.

CORE FORMATTING RULES:
- Every response must be a SINGLE combined query.
- Every query must begin exactly with: TO THE JM:
- Every query involving an unresolved production issue must end exactly with: The file is in pending status until the matter is resolved. Thank you.
- Use "the text body" instead of "the manuscript" for uncited items.
- If the input contains multiple issues, MERGE them into one cohesive query. Do NOT repeat "TO THE JM:" or the pending clause for each issue. Use a single "TO THE JM:" at the start and a single pending clause at the end. Label each distinct concern with (a), (b), (c), etc. within the same paragraph. Do NOT use line breaks or bullet points; the entire query must be a single continuous block of text.

TONE SELECTION:
- Direct/Strict: For technical faults, unusable files, missing metadata. Use "Kindly provide", "Unusable due to...", "The file is unreadable", "Please resupply in acceptable format".
- Collaborative/Soft: For ambiguous author intent or editorial guidance. Use "Kindly assist the author", "Please advise on the best way to proceed", "Kindly confirm how we may proceed".
- Neutral/Procedural: For formal reporting. No directive tone. Report and request verification.

FIGURE REPLACEMENT PROTOCOLS:
- Scenario A (Detailed instructions): "The author has provided a replacement for [Figure X] that includes content changes compared to the current version. The author notes that [summarize comment]. Please confirm if we can use this replacement image."
- Scenario B (No details): "The author provided a replacement for [Figure X]. However, it is unclear whether the reason for this replacement is quality improvement, addition/removal of elements, or changed content. Please validate if we can proceed with the new version."
- Scenario C (Technical faults): Use terms like "pixelated text", "cutoff data", "unconverted characters", "blurry and overlapping data", "poor image and text quality", "unusable in present format". Request PDF, TIF, JPG, or DOC format.

UNCITED ITEMS & MISMATCHES:
- Uncited Items:
  - Direct: "Kindly ask the author to provide citations for [Reference/Figure/Table X] in the text body or confirm if this could be deleted."
  - Soft: "Kindly assist the author in providing citations for [Reference/Figure/Table X] in the text body or confirm if they may be removed."
  - Neutral: "The following [Reference/Figure/Table X] is currently uncited in the text body. Please verify with the author whether a citation is needed or if it may be deleted."
- Panel Label Mismatch: "Panels [X] have been mentioned in the figure caption but are not found in the artwork. Please check and amend as necessary."
- Symbol Mismatch: "Symbol A]' is mentioned in the caption but '[Symbol B]' is present in the artwork. Please check and amend as necessary."

METADATA & ADMINISTRATIVE:
- Coversheet Updates: "If affirmed, kindly update coversheet accordingly reflecting [X] physical figures/tables/schemes/GA." or "If affirmed, kindly update coversheet accordingly reflecting the revised article title." (Mandatory for addition/removal of figures, tables, schemes, GA, or edits to the article title).
- Author Changes: "Please validate author's request to [add/remove/reorder] authors." (Do NOT include coversheet updates for author changes).
- Name Clarification: "Please confirm if [Name A] is the given name and [Name B] is the surname to ensure correct indexing."

OUTPUT REQUIREMENTS:
- Generate production-ready TO THE JM queries.
- Apply correct tone automatically.
- Include pending clause when required.
- Follow all formatting rules strictly.
- Output ONLY the final query.
- Do NOT include explanations, commentary, or labels.`;

const JM_OFFLINE_FALLBACK_PREFIX = 'TO THE JM: Please review the following production matter: ';

function buildOfflineQuery(input: string, refine: { previous: string; feedback: string } | null): string {
  const promptRefineClause = refine
    ? ` Previous query draft: "${refine.previous}". Author feedback: "${refine.feedback}". `
    : ' ';
  const pendingClause = /figure|table|missing|mismatch|panel|uncited|incorrect|cutoff|unusable|error|pending|change|correct|replace|update|add|remove|confirm|clarif|verify|suppli|author|query/i.test(input) || (refine && !!/pending|correct|confirm/i.test(refine.previous + refine.feedback))
    ? ' The file is in pending status until the matter is resolved. Thank you.'
    : '';
  return `${JM_OFFLINE_FALLBACK_PREFIX}${input}${promptRefineClause.trim()}${pendingClause}`.trim();
}

export const config = { runtime: 'nodejs', maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  try {
    const { input, refine } = req.body || {};
    const rawInput = typeof input === 'string' ? input : '';
    const refined =
      refine && typeof refine.previous === 'string' && typeof refine.feedback === 'string' ? refine : null;

    if (!rawInput.trim()) {
      return res.status(400).json({ error: 'Input text is required.' });
    }

    const prompt = refined
      ? `ORIGINAL INPUT: ${rawInput}\n\nPREVIOUS GENERATED QUERY: ${refined.previous}\n\nUSER FEEDBACK/CORRECTION: ${refined.feedback}\n\nPlease regenerate the query based on the feedback while still following all the core rules.`
      : rawInput;

    if (!hasAnyLlmProvider()) {
      return res.json({ reply: buildOfflineQuery(rawInput, refined), modelUsed: 'offline-jm-query' });
    }

    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
    let reply = '';
    let modelUsed = '';

    try {
      const result = await callChatWithHistory(messages, {
        candidates: JM_QUERY_CANDIDATES,
        systemInstruction: JM_QUERY_SYSTEM_INSTRUCTION,
        timeoutMs: 12000,
        onError: (c, err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[jm-query] Candidate ${c.model} (${c.provider}) failed: ${message}`);
        },
      });
      reply = (result.text || '').trim();
      modelUsed = result.model;
    } catch {
      reply = '';
      modelUsed = '';
    }

    if (!reply) {
      return res.json({
        reply: buildOfflineQuery(rawInput, refined),
        modelUsed: 'offline-jm-query-fallback',
      });
    }

    return res.json({ reply, modelUsed });
  } catch (err: any) {
    console.error('[jm-query] Unexpected error:', err);
    const rawInput = typeof req.body?.input === 'string' ? req.body.input : '';
    return res.json({
      reply: buildOfflineQuery(rawInput, null),
      modelUsed: 'offline-jm-query-recovery',
    });
  }
}
