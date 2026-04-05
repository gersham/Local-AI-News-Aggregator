import { createXai } from '@ai-sdk/xai';
import { writeActivityLog } from '@news-aggregator/core';
import { generateText, Output } from 'ai';
import type { z } from 'zod';

export type LlmOptions = {
  apiKey?: string;
  model?: string;
};

const DEFAULT_MODEL = 'grok-4-1-fast-non-reasoning';
const PODCAST_MODEL = 'grok-4.20-0309-non-reasoning';

export function getDefaultModel() {
  return process.env.XAI_MODEL ?? DEFAULT_MODEL;
}

export function getPodcastModel() {
  return process.env.XAI_PODCAST_MODEL ?? PODCAST_MODEL;
}

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

// xAI pricing per million tokens
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'grok-4-1-fast-non-reasoning': { input: 0.2, output: 0.5 },
  'grok-4-1-fast-reasoning': { input: 0.2, output: 0.5 },
  'grok-4.20-0309-non-reasoning': { input: 2.0, output: 6.0 },
  'grok-4.20-0309-reasoning': { input: 2.0, output: 6.0 },
};

function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
) {
  const pricing = MODEL_PRICING[model] ?? { input: 0.2, output: 0.5 };

  return (
    (promptTokens / 1_000_000) * pricing.input +
    (completionTokens / 1_000_000) * pricing.output
  );
}

function getClient(apiKey?: string) {
  return createXai({
    apiKey: apiKey ?? process.env.XAI_API_KEY,
  });
}

export async function chatCompletion(
  options: LlmOptions & {
    system: string;
    prompt: string;
    maxOutputTokens?: number;
  },
): Promise<{ text: string; usage: LlmUsage }> {
  const xai = getClient(options.apiKey);
  const model = options.model ?? getDefaultModel();

  writeActivityLog({
    severity: 'info',
    source: 'llm',
    message: 'Chat completion request',
    metadata: {
      model,
      system: options.system,
      prompt: options.prompt,
    },
  }).catch(() => {});

  try {
    const result = await generateText({
      model: xai(model),
      system: options.system,
      prompt: options.prompt,
      maxOutputTokens: options.maxOutputTokens ?? 4000,
    });

    const promptTokens = result.usage?.inputTokens ?? 0;
    const completionTokens = result.usage?.outputTokens ?? 0;
    const usage: LlmUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd: estimateCost(model, promptTokens, completionTokens),
    };

    writeActivityLog({
      severity: 'info',
      source: 'llm',
      message: `Chat completion response (${usage.totalTokens} tokens, $${usage.estimatedCostUsd.toFixed(4)})`,
      metadata: {
        model,
        ...usage,
        outputLength: result.text.length,
        output: result.text,
      },
    }).catch(() => {});

    return { text: result.text, usage };
  } catch (error) {
    writeActivityLog({
      severity: 'error',
      source: 'llm',
      message: `Chat completion error: ${error instanceof Error ? error.message : String(error)}`,
      metadata: {
        model,
        prompt: options.prompt,
      },
    }).catch(() => {});
    throw error;
  }
}

export async function structuredCompletion<T extends z.ZodType>(
  options: LlmOptions & {
    system: string;
    prompt: string;
    schema: T;
    maxOutputTokens?: number;
  },
): Promise<{ object: z.infer<T>; usage: LlmUsage }> {
  const xai = getClient(options.apiKey);
  const model = options.model ?? getDefaultModel();

  writeActivityLog({
    severity: 'info',
    source: 'llm',
    message: 'Structured completion request',
    metadata: {
      model,
      system: options.system,
      prompt: options.prompt,
    },
  }).catch(() => {});

  try {
    const result = await generateText({
      model: xai(model),
      system: options.system,
      prompt: options.prompt,
      output: Output.object({ schema: options.schema }),
      maxOutputTokens: options.maxOutputTokens ?? 2000,
    });

    const promptTokens = result.usage?.inputTokens ?? 0;
    const completionTokens = result.usage?.outputTokens ?? 0;
    const usage: LlmUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd: estimateCost(model, promptTokens, completionTokens),
    };

    writeActivityLog({
      severity: 'info',
      source: 'llm',
      message: `Structured completion response (${usage.totalTokens} tokens, $${usage.estimatedCostUsd.toFixed(4)})`,
      metadata: {
        model,
        ...usage,
        output: result.output as Record<string, unknown>,
      },
    }).catch(() => {});

    return { object: result.output as z.infer<T>, usage };
  } catch (error) {
    writeActivityLog({
      severity: 'error',
      source: 'llm',
      message: `Structured completion error: ${error instanceof Error ? error.message : String(error)}`,
      metadata: {
        model,
        prompt: options.prompt,
      },
    }).catch(() => {});
    throw error;
  }
}
