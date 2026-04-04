import { buildSourceFixture } from '@news-aggregator/test-utils';
import { describe, expect, it, vi } from 'vitest';
import {
  buildXSearchPlans,
  createXSearchRequest,
  executeXSearchPlan,
  getXSearchOutputText,
} from './x-search';

describe('buildXSearchPlans', () => {
  it('selects active x-search sources with queries', () => {
    const plans = buildXSearchPlans({
      sources: [
        buildSourceFixture({
          id: 'x-my-feed',
          type: 'social',
          fetchMethod: 'x-search',
          query: 'AI tech singularity news',
        }),
        buildSourceFixture({
          id: 'hn-home',
          fetchMethod: 'http',
          seedUrls: ['https://news.ycombinator.com/'],
        }),
        buildSourceFixture({
          id: 'reddit-home',
          fetchMethod: 'browser-scrape',
          enabled: false,
          executionMode: 'manual-opt-in',
          requiresAuthentication: true,
        }),
      ],
    });

    expect(plans).toEqual([
      {
        query: 'AI tech singularity news',
        sourceId: 'x-my-feed',
      },
    ]);
  });
});

describe('createXSearchRequest', () => {
  it('builds a responses payload with the x_search tool', () => {
    const payload = createXSearchRequest(
      {
        query: 'AI tech singularity news',
        sourceId: 'x-my-feed',
      },
      {
        model: 'grok-4.20-reasoning',
      },
    );

    expect(payload).toMatchObject({
      model: 'grok-4.20-reasoning',
      max_turns: 3,
      input: [
        {
          role: 'system',
          content: expect.stringContaining('Return strict JSON'),
        },
        {
          role: 'user',
          content: 'AI tech singularity news',
        },
      ],
      tools: [
        {
          type: 'x_search',
        },
      ],
    });
  });
});

describe('executeXSearchPlan', () => {
  it('posts a responses request to xAI and returns the parsed JSON', async () => {
    const fetchMock = vi.fn(
      async (
        _input: string | URL | Request,
        _init?: RequestInit,
      ): Promise<Response> => {
        return new Response(
          JSON.stringify({
            id: 'resp_123',
            output_text: 'summary',
            tool_calls: [],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      },
    );

    const result = await executeXSearchPlan(
      {
        query: 'AI tech singularity news',
        sourceId: 'x-my-feed',
      },
      {
        apiKey: 'xai-test-key',
        fetchImplementation: fetchMock,
        model: 'grok-4.20-reasoning',
      },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(url).toBe('https://api.x.ai/v1/responses');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer xai-test-key',
      },
    });
    expect(result).toMatchObject({
      content: {
        id: 'resp_123',
        output_text: 'summary',
        tool_calls: [],
      },
      sourceId: 'x-my-feed',
    });
  });
});

describe('getXSearchOutputText', () => {
  it('falls back to assistant message content when output_text is absent', () => {
    expect(
      getXSearchOutputText({
        output: [
          {
            type: 'message',
            content: [
              {
                text: '{"stories":[{"title":"AI funding climbs again","url":"https://example.com/ai-funding","publishedAt":"2026-04-04","summary":"Funding remains strong.","topics":["ai"],"regions":[]}]}',
                type: 'output_text',
              },
            ],
          },
        ],
      }),
    ).toContain('AI funding climbs again');
  });
});
