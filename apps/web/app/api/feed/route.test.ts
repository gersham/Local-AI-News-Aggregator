import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMongoTestContext } from '@news-aggregator/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { GET } from './route';

const tempRoots: string[] = [];
const cleanupTasks: Array<() => Promise<void>> = [];

afterEach(async () => {
  delete process.env.MONGODB_DB_NAME;
  delete process.env.MONGODB_URI;
  delete process.env.FEED_SNAPSHOT_EXAMPLE_PATH;
  delete process.env.FEED_SNAPSHOT_LEGACY_PATH;
  delete process.env.FEED_SNAPSHOT_PATH;

  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }

  for (const cleanup of cleanupTasks.splice(0)) {
    await cleanup();
  }
});

describe('GET /api/feed', () => {
  it('returns a setup-blocked response when mongodb is not configured', async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toContain('MONGODB_URI');
  });

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
    process.env.FEED_SNAPSHOT_LEGACY_PATH = join(
      root,
      'data',
      'feed-snapshot.json',
    );
    const mongo = await createMongoTestContext();
    cleanupTasks.push(mongo.cleanup);
    process.env.MONGODB_DB_NAME = mongo.dbName;
    process.env.MONGODB_URI = mongo.uri;

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.usingExampleFallback).toBe(true);
    expect(payload.snapshot.entries[0]?.clusterId).toBe('cluster_1');
  });
});
