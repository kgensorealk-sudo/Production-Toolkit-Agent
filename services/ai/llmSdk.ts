// services/ai/llmSdk.ts
//
// Pure LLM-calling module -- the single execution path for every LLM call
// in the repo (Phase 0.3). No Express/Vercel dependencies, so it can be
// called from anywhere under services/ or utils/.
//
// Two public entry points share one internal execution loop:
//   - callChatWithHistory(): the contract chatHandler.ts, grantExtractHandler.ts,
//     and jmQueryHandler.ts are already built against. Returns {text, model}.
//   - callChat<T>(): richer envelope ({data, model, provider, usage}) with
//     jsonSchema support, multi-turn messages, and 'openai-compatible' local
//     providers -- built for Phase 0.4's OPT chain and any future caller that
//     needs structured output or provider/usage metadata.

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

export type LlmProvider = 'gemini' | 'openai' | 'openai-compatible';

export interface LlmCandidate {
  provider: LlmProvider;
  model: string;
  // Required for provider: 'openai-compatible'. The base URL of the local/
  // self-hosted OpenAI-compatible endpoint (e.g. http://localhost:11434/v1
  // for Ollama). Ignored for 'gemini' and 'openai'.
  baseURL?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CallChatOptions {
  model?: string;
  candidates?: LlmCandidate[];
  systemInstruction?: string;
  jsonSchema?: object;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  // Fired once per candidate that fails, before moving to the next one.
  // Callers use this for per-candidate diagnostic logging.
  onError?: (candidate: LlmCandidate, err: unknown) => void;
}

export interface CallChatResult<T = string> {
  data: T;
  model: string;
  provider: LlmProvider;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

const DEFAULT_TIMEOUT_MS = 12000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export function hasAnyLlmProvider(): boolean {
  return Boolean(process.env.GEMINI_API_KEY) || Boolean(process.env.OPENAI_API_KEY);
}

// Local/self-hosted OpenAI-compatible endpoints are keyed by baseURL, since
// there can be more than one (e.g. Ollama on one port, LM Studio on another).
const openaiCompatibleClients = new Map<string, OpenAI>();

function getOpenAICompatibleClient(baseURL: string): OpenAI {
  const cached = openaiCompatibleClients.get(baseURL);
  if (cached) return cached;
  // Most local providers ignore the API key entirely, but the SDK requires
  // a non-empty string to construct. Real key (if the local server checks
  // one) can be supplied via OPENAI_COMPATIBLE_API_KEY.
  const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY || 'not-needed';
  const client = new OpenAI({ apiKey, baseURL });
  openaiCompatibleClients.set(baseURL, client);
  return client;
}

function splitSystemMessages(messages: ChatMessage[], explicitSystemInstruction?: string): {
  systemInstruction: string;
  conversation: ChatMessage[];
} {
  const systemFromMessages = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const conversation = messages.filter((m) => m.role !== 'system');
  const systemInstruction = [explicitSystemInstruction, systemFromMessages]
    .filter(Boolean)
    .join('\n\n');
  return { systemInstruction, conversation };
}

function toGeminiContents(conversation: ChatMessage[]) {
  return conversation.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

function toOpenAIMessages(conversation: ChatMessage[], systemInstruction: string) {
  const base = systemInstruction
    ? [{ role: 'system' as const, content: systemInstruction }]
    : [];
  return [
    ...base,
    ...conversation.map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.content,
    })),
  ];
}

interface RawCallResult {
  text: string;
  model: string;
  provider: LlmProvider;
  usage?: CallChatResult['usage'];
}

// Shared execution loop -- both public entry points call this. This is the
// actual "single source of truth" Phase 0.3 exists to establish: one place
// that knows how to talk to Gemini / OpenAI / openai-compatible, with
// candidate fallback and per-model timeout, full stop.
async function executeCandidates(
  messages: ChatMessage[],
  options: CallChatOptions
): Promise<RawCallResult> {
  const geminiClient = getGeminiClient();
  const openaiClient = getOpenAIClient();

  const candidates: LlmCandidate[] =
    options.candidates ??
    (options.model
      ? [{ provider: openaiClient ? 'openai' : 'gemini', model: options.model }]
      : []);

  if (candidates.length === 0) {
    throw new Error('callChat/callChatWithHistory requires either options.model or options.candidates.');
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { systemInstruction, conversation } = splitSystemMessages(messages, options.systemInstruction);

  let lastError: any = null;

  for (const candidate of candidates) {
    if (candidate.provider === 'gemini' && !geminiClient) continue;
    if (candidate.provider === 'openai' && !openaiClient) continue;
    if (candidate.provider === 'openai-compatible' && !candidate.baseURL) continue;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Model ${candidate.model} request timed out after ${timeoutMs / 1000}s`)),
          timeoutMs
        )
      );

      let text = '';
      let usage: CallChatResult['usage'];

      if (candidate.provider === 'gemini') {
        const geminiContents = toGeminiContents(conversation);
        const config: any = { systemInstruction };
        if (options.jsonSchema) {
          config.responseMimeType = 'application/json';
          config.responseSchema = options.jsonSchema;
        }
        const modelPromise = geminiClient!.models.generateContent({
          model: candidate.model,
          contents: geminiContents,
          config,
        });
        const response: any = await Promise.race([modelPromise, timeoutPromise]);
        text = response?.text || '';
        usage = {
          promptTokens: response?.usageMetadata?.promptTokenCount,
          completionTokens: response?.usageMetadata?.candidatesTokenCount,
        };
      } else {
        // 'openai' and 'openai-compatible' share the same call shape.
        const client = candidate.provider === 'openai' ? openaiClient! : getOpenAICompatibleClient(candidate.baseURL!);
        const openaiMessages = toOpenAIMessages(conversation, systemInstruction);
        const requestBody: any = {
          model: candidate.model,
          messages: openaiMessages,
        };
        if (options.temperature !== undefined) requestBody.temperature = options.temperature;
        if (options.maxTokens !== undefined) requestBody.max_tokens = options.maxTokens;
        if (options.jsonSchema) {
          requestBody.response_format = {
            type: 'json_schema',
            json_schema: {
              name: 'callChat_response',
              schema: options.jsonSchema,
              strict: true,
            },
          };
        }
        const modelPromise = client.chat.completions.create(requestBody);
        const response: any = await Promise.race([modelPromise, timeoutPromise]);
        text = response?.choices?.[0]?.message?.content || '';
        usage = {
          promptTokens: response?.usage?.prompt_tokens,
          completionTokens: response?.usage?.completion_tokens,
        };
      }

      if (text) {
        return { text, model: candidate.model, provider: candidate.provider, usage };
      }
      // Empty text is treated the same as an error -- fall through to next candidate.
      lastError = lastError ?? new Error(`Model ${candidate.model} returned empty text.`);
    } catch (err: any) {
      lastError = err;
      options.onError?.(candidate, err);
    }
  }

  throw lastError ?? new Error('All candidate models failed to return a response.');
}

function parseResult<T>(text: string, jsonSchema: object | undefined): T {
  if (!jsonSchema) return text as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(`Model response was not valid JSON despite jsonSchema being set: ${(err as Error).message}`);
  }
}

// The contract chatHandler.ts, grantExtractHandler.ts, and jmQueryHandler.ts
// are already built against. Kept intentionally simple ({text, model}) --
// these callers only ever want the string reply and which model answered.
export async function callChatWithHistory(
  messages: ChatMessage[],
  options: CallChatOptions = {}
): Promise<{ text: string; model: string }> {
  const result = await executeCandidates(messages, options);
  return { text: result.text, model: result.model };
}

// Richer envelope for callers that need structured (jsonSchema) output
// and/or provider/usage metadata -- e.g. Phase 0.4's OPT chain, which needs
// to know which model produced a result for its validation/coverage metrics.
export async function callChat<T = string>(
  messages: ChatMessage[],
  options: CallChatOptions = {}
): Promise<CallChatResult<T>> {
  const result = await executeCandidates(messages, options);
  return {
    data: parseResult<T>(result.text, options.jsonSchema),
    model: result.model,
    provider: result.provider,
    usage: result.usage,
  };
}
