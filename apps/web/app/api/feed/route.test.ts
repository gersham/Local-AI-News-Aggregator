import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GET } from './route';

const tempRoots: string[] = [];

afterEach(() => {
  delete process.env.FEED_SNAPSHOT_EXAMPLE_PATH;
  delete process.env.FEED_SNAPSHOT_PATH;

  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('GET /api/feed', () => {
  it('returns a feed snapshot with fallback metadata', async () => {
    const root = join(tmpdir(), `news-feed-route-${Date.now()}`);
    tempRoots.push(root);
    mkdirSync(join(root, 'config'), { recursive: true });

    const examplePath = join(root, 'config', 'feed-preview.example.json');

    writeFileSync(
      examplePath,
      JSON.stringify({
        entries: [
          {
            canonicalUrl: 'https://example.com/story',
            citationCount: 2,
            clusterId: 'cluster_1',
            headline: 'AI lab releases new reasoning system',
            publishedAt: '2026-04-04T14:20:00.000Z',
            rank: 1,
            ranking: {
              baseScore: 0.72,
              corroborationScore: 0.06,
              freshnessScore: 0.17,
              sourceTypeScore: 0.03,
              totalScore: 0.98,
            },
            reasons: ['Fresh within the last day.'],
            regions: ['global'],
            sourceCount: 2,
            sourceNames: ['My X Feed', 'Hacker News Homepage'],
            summary: 'A major AI lab released a new reasoning system.',
            topics: ['ai', 'tech'],
          },
        ],
        generatedAt: '2026-04-04T15:00:00.000Z',
      }),
    );

    process.env.FEED_SNAPSHOT_EXAMPLE_PATH = examplePath;
    process.env.FEED_SNAPSHOT_PATH = join(root, 'data', 'feed-snapshot.json');

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.usingExampleFallback).toBe(true);
    expect(payload.snapshot.entries[0]?.clusterId).toBe('cluster_1');
  });
});
