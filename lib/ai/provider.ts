import { GoogleGenAI } from "@google/genai";

export interface GenerateJsonArgs {
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GenerateJsonResult {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  raw?: unknown;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generateJson(args: GenerateJsonArgs): Promise<GenerateJsonResult>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export interface GeminiProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

export function createGeminiProvider(
  options: GeminiProviderOptions,
): AiProvider {
  const client = new GoogleGenAI({
    apiKey: options.apiKey,
    httpOptions: { timeout: options.timeoutMs ?? 60000 },
  });

  return {
    name: "gemini",
    model: options.model,
    async generateJson(args: GenerateJsonArgs): Promise<GenerateJsonResult> {
      let response;
      try {
        response = await client.models.generateContent({
          model: options.model,
          contents: args.prompt,
          config: {
            systemInstruction: args.system,
            temperature: args.temperature ?? 0.4,
            maxOutputTokens: args.maxOutputTokens ?? 4096,
            responseMimeType: "application/json",
          },
        });
      } catch (err) {
        const status = (err as { status?: number })?.status ?? 0;
        const retryable = status === 0 ? true : isRetryableStatus(status);
        throw new AiProviderError(
          `Gemini request failed: ${(err as Error)?.message ?? "unknown"}`,
          retryable,
          err,
        );
      }

      const text = response.text;
      if (!text || text.trim().length === 0) {
        throw new AiProviderError("Gemini returned an empty response", true);
      }

      return {
        text,
        model: response.modelVersion ?? options.model,
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: response.usageMetadata?.candidatesTokenCount,
        raw: response,
      };
    },
  };
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Retries only transient provider failures (network/timeout/429/5xx). Permanent
 * errors (bad request, safety block) are surfaced immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = err instanceof AiProviderError ? err.retryable : false;
      if (!retryable || attempt === attempts) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      options.onRetry?.(attempt, err, delay);
      await sleep(delay);
    }
  }
  throw lastError;
}
