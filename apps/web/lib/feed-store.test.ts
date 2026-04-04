import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMongoTestContext } from '@news-aggregator/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { loadFeedSnapshot, resolveFeedSnapshotPaths } from './feed-store';

const tempRoots: string[] = [];
const cleanupTasks: Array<() => Promise<void>> = [];

afterEach(async () => {
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

describe('resolveFeedSnapshotPaths', () => {
  it('derives legacy-import and example feed paths from the project root', () => {
    const root = join(tmpdir(), 'news-feed-paths');
    const paths = resolveFeedSnapshotPaths({ projectRoot: root });

    expect(paths.legacyPath).toBe(join(root, 'data', 'feed-snapshot.json'));
    expect(paths.examplePath).toBe(
      join(root, 'config', 'feed-preview.example.json'),
    );
  });
});

describe('loadFeedSnapshot', () => {
  it('falls back to the example snapshot when no writable snapshot exists', async () => {
    const root = join(tmpdir(), `news-feed-load-${Date.now()}`);
    tempRoots.push(root);
    mkdirSync(join(root, 'config'), { recursive: true });

    writeFileSync(
      join(root, 'config', 'feed-preview.example.json'),
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

    const mongo = await createMongoTestContext();
    cleanupTasks.push(mongo.cleanup);

    const state = await loadFeedSnapshot({
      dbName: mongo.dbName,
      projectRoot: root,
      uri: mongo.uri,
    });

    expect(state.usingExampleFallback).toBe(true);
    expect(state.snapshot.entries[0]?.headline).toBe(
      'AI lab releases new reasoning system',
    );
    expect(state.storageTarget).toContain(mongo.dbName);
  });
});
