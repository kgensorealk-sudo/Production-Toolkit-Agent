import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  GRANT_EXTRACTION_SYSTEM_PROMPT, 
  sanitizeGrantExtractionResult, 
  extractGrantsOffline 
} from './grantExtractor.js';
import {
  callChatWithHistory,
  hasAnyLlmProvider,
  ChatMessage,
  LlmCandidate,
} from '../services/ai/llmSdk.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

const CANDIDATES: LlmCandidate[] = [
  { model: 'gemini-3.8-flash', provider: 'gemini' },
  { model: 'gemini-3.1-flash-lite', provider: 'gemini' },
  { model: 'gemini-flash-latest', provider: 'gemini' },
  { model: 'gemini-3.7-flash', provider: 'gemini' },
  { model: 'gpt-4o-mini', provider: 'openai' },
  { model: 'gpt-4o', provider: 'openai' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { statement } = req.body || {};
    const textToAnalyze = (statement || '').trim();

    if (!textToAnalyze) {
      return res.status(400).json({ error: 'Funding statement is required.' });
    }

    // If neither provider is configured, run offline extractor immediately
    if (!hasAnyLlmProvider()) {
      const offlineResult = extractGrantsOffline(textToAnalyze);
      return res.json({
        result: offlineResult.formattedText,
        pairs: offlineResult.pairs,
        sponsorsCount: offlineResult.pairs.length,
        modelUsed: 'offline-keeper',
        note: 'Running in Offline Editorial Engine mode.',
      });
    }

    const prompt = `Analyze the following funding statement according to your instructions:\n\n"""\n${textToAnalyze}\n"""`;
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

    let rawOutput = '';
    let activeModel = '';

    try {
      const result = await callChatWithHistory(messages, {
        candidates: CANDIDATES,
        systemInstruction: GRANT_EXTRACTION_SYSTEM_PROMPT,
        timeoutMs: 12000,
        onError: (candidate, err) => {
          console.warn(
            `[grant-extract] ${candidate.model} failed, trying next candidate:`,
            err instanceof Error ? err.message : err
          );
        },
      });
      rawOutput = (result.text || '').trim();
      activeModel = result.model;
    } catch {
      // Absorb at this layer; rawOutput stays empty so the existing fallback
      // path runs with label "offline-keeper-fallback". Per-candidate errors
      // are already logged via onError above, so we don't double-log.
      rawOutput = '';
      activeModel = '';
    }

    // If AI calls produced a response, sanitize and parse
    if (rawOutput) {
      const sanitized = sanitizeGrantExtractionResult(rawOutput);
      return res.json({
        result: sanitized.formattedText,
        pairs: sanitized.pairs,
        sponsorsCount: sanitized.pairs.length,
        modelUsed: activeModel,
      });
    }

    // If all candidates failed or timed out, gracefully fall back to the offline engine
    const fallbackResult = extractGrantsOffline(textToAnalyze);
    return res.json({
      result: fallbackResult.formattedText,
      pairs: fallbackResult.pairs,
      sponsorsCount: fallbackResult.pairs.length,
      modelUsed: 'offline-keeper-fallback',
      note: 'AI providers temporarily unavailable. Processed via Keeper Rule Engine.',
    });
  } catch (error: any) {
    console.error('[grant-extract] Unexpected error:', error);
    // Even on error, return offline rule engine fallback so user's workflow is never blocked
    try {
      const statement = (req.body?.statement || '').trim();
      const fallbackResult = extractGrantsOffline(statement);
      return res.json({
        result: fallbackResult.formattedText,
        pairs: fallbackResult.pairs,
        sponsorsCount: fallbackResult.pairs.length,
        modelUsed: 'offline-keeper-recovery',
      });
    } catch {
      return res.status(500).json({ error: error?.message || 'Failed to analyze funding statement' });
    }
  }
}
