import { getRunnableSources, type SourceRegistry } from '@news-aggregator/core';

export type XSearchPlan = {
  query: string;
  sourceId: string;
};

export type XSearchResponsePayload = {
  id?: string;
  output?: unknown;
  output_text?: string;
  tool_calls?: unknown[];
};

export function buildXSearchPlans(registry: SourceRegistry) {
  return getRunnableSources(registry).flatMap((source): XSearchPlan[] => {
    if (source.fetchMethod !== 'x-search' || !source.query) {
      return [];
    }

    return [
      {
        query: source.query,
        sourceId: source.id,
      },
    ];
  });
}

export function createXSearchRequest(
  plan: XSearchPlan,
  options: {
    model?: string;
  } = {},
) {
  return {
    model: options.model ?? 'grok-4.20-reasoning',
    input: [
      {
        role: 'system',
        content:
          'Return strict JSON with shape {"stories":[{"title":"","url":"","publishedAt":"","summary":"","topics":[],"regions":[]}]} and no markdown.',
      },
      {
        role: 'user',
        content: plan.query,
      },
    ],
    tools: [
      {
        type: 'x_search',
      },
    ],
    max_turns: 3,
  };
}

export async function executeXSearchPlan(
  plan: XSearchPlan,
  options: {
    apiKey: string;
    fetchImplementation?: typeof fetch;
    model?: string;
  },
) {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const response = await fetchImplementation('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(
      createXSearchRequest(plan, {
        model: options.model,
      }),
    ),
  });

  if (!response.ok) {
    throw new Error(
      `xAI X search request failed with status ${response.status}.`,
    );
  }

  return {
    content: (await response.json()) as XSearchResponsePayload,
    sourceId: plan.sourceId,
  };
}
