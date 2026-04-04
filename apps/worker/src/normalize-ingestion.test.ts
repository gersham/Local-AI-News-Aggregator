import { buildSourceFixture } from '@news-aggregator/test-utils';
import { describe, expect, it } from 'vitest';
import {
  normalizeExaSearchArtifact,
  normalizeXSearchExecutionResult,
} from './normalize-ingestion';

describe('normalizeExaSearchArtifact', () => {
  it('maps Exa search results into normalized stories', () => {
    const stories = normalizeExaSearchArtifact({
      artifact: {
        artifactKey: 'discovery-exa-search',
        content: JSON.stringify({
          results: [
            {
              publishedDate: '2026-04-04T10:30:00.000Z',
              text: 'Lantzville council approved a waterfront plan update.',
              title: 'Lantzville council approves waterfront plan',
              url: 'https://example.com/lantzville?utm_source=exa',
            },
          ],
        }),
        fetchedAt: '2026-04-04T10:35:00.000Z',
        sourceId: 'bc-news-search',
        target: 'latest British Columbia Vancouver Canada news',
      },
      source: buildSourceFixture({
        id: 'bc-news-search',
        name: 'BC News',
        type: 'watchlist',
        fetchMethod: 'exa-search',
        query: 'latest British Columbia Vancouver Canada news',
        topics: ['bc', 'canada'],
        regions: ['bc', 'canada'],
      }),
    });

    expect(stories).toHaveLength(1);
    expect(stories[0]).toMatchObject({
      canonicalUrl: 'https://example.com/lantzville',
      sourceId: 'bc-news-search',
      sourceName: 'BC News',
      title: 'Lantzville council approves waterfront plan',
      topics: ['bc', 'canada'],
    });
  });
});

describe('normalizeXSearchExecutionResult', () => {
  it('parses strict JSON from xAI output_text into normalized stories', () => {
    const stories = normalizeXSearchExecutionResult({
      result: {
        content: {
          id: 'resp_123',
          output_text: `\`\`\`json
{"stories":[{"title":"AI funding jumps in 2026","url":"https://example.com/ai-funding?utm_source=x","publishedAt":"2026-04-04T09:00:00.000Z","summary":"Investors continue backing AI companies.","topics":["ai","tech"],"regions":["global"]}]}
\`\`\``,
          tool_calls: [],
        },
        sourceId: 'x-my-feed',
      },
      source: buildSourceFixture({
        id: 'x-my-feed',
        name: 'My X Feed',
        type: 'social',
        fetchMethod: 'x-search',
        query: 'AI tech singularity news',
        topics: ['ai', 'tech', 'singularity'],
        regions: ['global'],
      }),
    });

    expect(stories).toHaveLength(1);
    expect(stories[0]).toMatchObject({
      canonicalUrl: 'https://example.com/ai-funding',
      sourceId: 'x-my-feed',
      sourceType: 'social',
      title: 'AI funding jumps in 2026',
    });
  });
});
