import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSourceFixture } from '@news-aggregator/test-utils';
import { describe, expect, it } from 'vitest';
import {
  materializeFeedFromArtifacts,
  writeFeedSnapshot,
} from './feed-materializer';

describe('materializeFeedFromArtifacts', () => {
  it('builds a ranked feed snapshot from Exa and xAI artifacts', () => {
    const bcNewsSource = buildSourceFixture({
      baseWeight: 0.88,
      id: 'bc-news-search',
      name: 'BC News',
      type: 'watchlist',
      fetchMethod: 'exa-search',
      query: 'latest British Columbia Vancouver Canada news',
      topics: ['bc', 'canada'],
      regions: ['bc', 'canada'],
      trustWeight: 0.85,
    });
    const xFeedSource = buildSourceFixture({
      baseWeight: 0.95,
      id: 'x-my-feed',
      name: 'My X Feed',
      type: 'social',
      fetchMethod: 'x-search',
      query: 'AI tech singularity news',
      topics: ['ai', 'tech'],
      regions: ['global'],
      trustWeight: 0.8,
    });
    const sourceIndex = new Map([
      ['bc-news-search', bcNewsSource],
      ['x-my-feed', xFeedSource],
    ]);

    const snapshot = materializeFeedFromArtifacts({
      generatedAt: '2026-04-04T15:00:00.000Z',
      publicArtifacts: [
        {
          artifact: {
            artifactKey: 'discovery-exa-search',
            content: JSON.stringify({
              results: [
                {
                  publishedDate: '2026-04-04T09:00:00.000Z',
                  text: 'Lantzville council approved a waterfront plan update.',
                  title: 'Lantzville council approves waterfront plan',
                  url: 'https://example.com/lantzville?utm_source=exa',
                },
              ],
            }),
            fetchedAt: '2026-04-04T09:05:00.000Z',
            sourceId: 'bc-news-search',
            target: 'latest British Columbia Vancouver Canada news',
          },
          source: bcNewsSource,
        },
      ],
      sourceIndex,
      xSearchResults: [
        {
          result: {
            content: {
              id: 'resp_123',
              output_text:
                '{"stories":[{"title":"AI funding jumps in 2026","url":"https://example.com/ai-funding?utm_source=x","publishedAt":"2026-04-04T14:10:00.000Z","summary":"Investors continue backing AI companies.","topics":["ai","tech"],"regions":["global"]}]}',
              tool_calls: [],
            },
            sourceId: 'x-my-feed',
          },
          source: xFeedSource,
        },
      ],
    });

    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[0]?.headline).toBe('AI funding jumps in 2026');
    expect(snapshot.entries[1]?.headline).toBe(
      'Lantzville council approves waterfront plan',
    );
  });
});

describe('writeFeedSnapshot', () => {
  it('writes a pretty-printed snapshot to disk', async () => {
    const root = join(tmpdir(), `feed-snapshot-write-${Date.now()}`);
    const path = join(root, 'feed-snapshot.json');

    await writeFeedSnapshot(path, {
      entries: [],
      generatedAt: '2026-04-04T15:00:00.000Z',
    });

    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toContain('"generatedAt"');

    rmSync(root, { recursive: true, force: true });
  });
});
