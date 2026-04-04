import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getMongoCollectionNames,
  loadCachedArticlesFromMongo,
  loadFeedSnapshotFromMongo,
  loadPodcastRunsFromMongo,
  loadSourceRegistryFromMongo,
  loadStoriesFromMongo,
  loadStoryClustersFromMongo,
  saveCachedArticlesToMongo,
  saveFeedSnapshotToMongo,
  savePodcastRunToMongo,
  saveStoriesToMongo,
  saveStoryClustersToMongo,
  updateSourceDefinitionInMongo,
} from './mongo-store';

const tempRoots: string[] = [];
const cleanupTasks: Array<() => Promise<void>> = [];

async function createMongoTestContext() {
  const server = await MongoMemoryServer.create();
  const client = new MongoClient(server.getUri());

  await client.connect();

  return {
    client,
    dbName: `news_aggregator_test_${randomUUID().replace(/-/gu, '')}`,
    async cleanup() {
      await client.close();
      await server.stop();
    },
  };
}

afterEach(async () => {
  for (const cleanup of cleanupTasks.splice(0)) {
    await cleanup();
  }

  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe('loadSourceRegistryFromMongo', () => {
  it('seeds the source registry from the example file when Mongo is empty', async () => {
    const root = join(tmpdir(), `news-mongo-sources-${Date.now()}`);
    tempRoots.push(root);
    mkdirSync(join(root, 'config'), { recursive: true });
    writeFileSync(
      join(root, 'config', 'sources.example.json'),
      JSON.stringify({
        sources: [
          {
            id: 'x-my-feed',
            name: 'My X Feed',
            type: 'social',
            fetchMethod: 'x-search',
            enabled: true,
            executionMode: 'active',
            requiresAuthentication: false,
            schedule: '*/15 * * * *',
            topics: ['ai'],
            regions: ['global'],
            baseWeight: 0.95,
            trustWeight: 0.8,
          },
        ],
      }),
    );

    const mongo = await createMongoTestContext();
    cleanupTasks.push(mongo.cleanup);

    const state = await loadSourceRegistryFromMongo({
      client: mongo.client,
      dbName: mongo.dbName,
      sourceRegistryExamplePath: join(root, 'config', 'sources.example.json'),
    });

    expect(state.usingExampleFallback).toBe(true);
    expect(state.registry.sources[0]?.id).toBe('x-my-feed');
    expect(state.storageTarget).toContain(mongo.dbName);
  });

  it('updates and rereads the stored source registry document', async () => {
    const root = join(tmpdir(), `news-mongo-source-update-${Date.now()}`);
    tempRoots.push(root);
    mkdirSync(join(root, 'config'), { recursive: true });
    writeFileSync(
      join(root, 'config', 'sources.example.json'),
      JSON.stringify({
        sources: [
          {
            id: 'bc-news-search',
            name: 'BC News',
            type: 'watchlist',
            fetchMethod: 'exa-search',
            enabled: true,
            executionMode: 'active',
            requiresAuthentication: false,
            schedule: '*/30 * * * *',
            topics: ['bc'],
            regions: ['bc'],
            query: 'latest bc news',
            baseWeight: 0.88,
            trustWeight: 0.85,
          },
        ],
      }),
    );

    const mongo = await createMongoTestContext();
    cleanupTasks.push(mongo.cleanup);

    await loadSourceRegistryFromMongo({
      client: mongo.client,
      dbName: mongo.dbName,
      sourceRegistryExamplePath: join(root, 'config', 'sources.example.json'),
    });

    const updated = await updateSourceDefinitionInMongo({
      client: mongo.client,
      dbName: mongo.dbName,
      id: 'bc-news-search',
      patch: {
        additionalQueries: ['vancouver breaking news past 24 hours'],
        topics: ['bc', 'vancouver'],
      },
    });

    expect(updated.registry.sources[0]).toMatchObject({
      id: 'bc-news-search',
      additionalQueries: ['vancouver breaking news past 24 hours'],
      topics: ['bc', 'vancouver'],
    });
  });
});

describe('feed snapshot mongo storage', () => {
  it('imports the legacy feed snapshot file on first load', async () => {
    const root = join(tmpdir(), `news-mongo-feed-${Date.now()}`);
    tempRoots.push(root);
    mkdirSync(join(root, 'data'), { recursive: true });
    const legacyPath = join(root, 'data', 'feed-snapshot.json');
    writeFileSync(
      legacyPath,
      JSON.stringify({
        entries: [
          {
            canonicalUrl: 'https://example.com/story',
            citationCount: 1,
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
            sourceCount: 1,
            sourceNames: ['AI News'],
            summary: 'A major AI lab released a new reasoning system.',
            topics: ['ai', 'tech'],
          },
        ],
        generatedAt: '2026-04-04T15:00:00.000Z',
      }),
    );

    const mongo = await createMongoTestContext();
    cleanupTasks.push(mongo.cleanup);

    const state = await loadFeedSnapshotFromMongo({
      client: mongo.client,
      dbName: mongo.dbName,
      feedSnapshotLegacyPath: legacyPath,
    });

    expect(state.snapshot.entries[0]?.headline).toBe(
      'AI lab releases new reasoning system',
    );
    expect(state.usingExampleFallback).toBe(false);
  });

  it('saves and rereads the latest feed snapshot from Mongo', async () => {
    const mongo = await createMongoTestContext();
    cleanupTasks.push(mongo.cleanup);

    await saveFeedSnapshotToMongo(
      {
        entries: [
          {
            canonicalUrl: 'https://example.com/story',
            citationCount: 1,
            clusterId: 'cluster_1',
            headline: 'Frontier model ships new capability',
            publishedAt: '2026-04-04T20:00:00.000Z',
            rank: 1,
            ranking: {
              baseScore: 0.8,
              corroborationScore: 0.04,
              freshnessScore: 0.14,
              sourceTypeScore: 0.03,
              totalScore: 0.99,
            },
            reasons: ['Strong personal relevance.'],
            regions: ['global'],
            sourceCount: 1,
            sourceNames: ['AI News'],
            summary: 'A new model capability shipped.',
            topics: ['ai'],
          },
        ],
        generatedAt: '2026-04-04T20:30:00.000Z',
      },
      {
        client: mongo.client,
        dbName: mongo.dbName,
      },
    );

    const state = await loadFeedSnapshotFromMongo({
      client: mongo.client,
      dbName: mongo.dbName,
    });

    expect(state.snapshot.entries[0]?.headline).toBe(
      'Frontier model ships new capability',
    );
    expect(state.storageTarget).toContain(mongo.dbName);
  });
});

describe('article cache mongo storage', () => {
  it('caches article contents by normalized URL hash and reloads them', async () => {
    const mongo = await createMongoTestContext();
    cleanupTasks.push(mongo.cleanup);

    await saveCachedArticlesToMongo(
      [
        {
          publishedDate: '2026-04-04T20:00:00.000Z',
          summary: 'Cached summary.',
          text: 'Cached body text.',
          title: 'Cached article',
          url: 'https://example.com/story?utm_source=exa',
        },
      ],
      {
        client: mongo.client,
        dbName: mongo.dbName,
      },
    );

    const state = await loadCachedArticlesFromMongo(
      ['https://example.com/story', 'https://example.com/another-story'],
      {
        client: mongo.client,
        dbName: mongo.dbName,
      },
    );

    expect(state.hits).toHaveLength(1);
    expect(state.hits[0]?.url).toBe('https://example.com/story');
    expect(state.misses).toEqual(['https://example.com/another-story']);
    expect(state.storageTarget).toContain(mongo.dbName);
  });

  it('upserts a single cache document for equivalent tracked URLs and applies a 30 day ttl', async () => {
    const mongo = await createMongoTestContext();
    cleanupTasks.push(mongo.cleanup);

    await saveCachedArticlesToMongo(
      [
        {
          summary: 'First write.',
          text: 'Version one.',
          title: 'Tracked article',
          url: 'https://example.com/story?utm_source=exa',
        },
      ],
      {
        client: mongo.client,
        dbName: mongo.dbName,
      },
    );
    await saveCachedArticlesToMongo(
      [
        {
          summary: 'Second write.',
          text: 'Version two.',
          title: 'Tracked article',
          url: 'https://example.com/story?utm_campaign=test',
        },
      ],
      {
        client: mongo.client,
        dbName: mongo.dbName,
      },
    );

    const collection = mongo.client
      .db(mongo.dbName)
      .collection(getMongoCollectionNames().articleCache);
    const documents = await collection.find().toArray();
    const indexes = await collection.indexes();

    expect(documents).toHaveLength(1);
    expect(documents[0]?.article.text).toBe('Version two.');
    expect(documents[0]?.normalizedUrl).toBe('https://example.com/story');
    expect(documents[0]?.expiresAt).toBeInstanceOf(Date);
    expect(documents[0]?.cachedAt).toBeInstanceOf(Date);
    expect(
      documents[0]?.expiresAt.getTime() - documents[0]?.cachedAt.getTime(),
    ).toBe(30 * 24 * 60 * 60 * 1000);
    expect(
      indexes.some((index) => index.name === 'article_cache_url_hash'),
    ).toBe(true);
    expect(indexes.some((index) => index.name === 'article_cache_ttl')).toBe(
      true,
    );
  });
});

describe('story and cluster mongo storage', () => {
  it('stores and reloads stories and clusters as first-class collections', async () => {
    const mongo = await createMongoTestContext();
    cleanupTasks.push(mongo.cleanup);

    await saveStoriesToMongo(
      [
        {
          storyId: 'story_1',
          canonicalUrl: 'https://example.com/story',
          bodyText: 'Detailed article body text.',
          sourceId: 'ai-news',
          sourceName: 'AI News',
          sourceType: 'watchlist',
          publishedAt: '2026-04-04T18:00:00.000Z',
          summary: 'A major AI story advanced.',
          title: 'Major AI story advances',
          topics: ['ai'],
          regions: ['global'],
          citations: [
            {
              sourceId: 'ai-news',
              sourceName: 'AI News',
              url: 'https://example.com/story',
            },
          ],
          importanceScore: 0.86,
          personalScore: 0.92,
        },
      ],
      {
        client: mongo.client,
        dbName: mongo.dbName,
        generatedAt: '2026-04-04T18:30:00.000Z',
      },
    );

    await saveStoryClustersToMongo(
      [
        {
          clusterId: 'cluster_1',
          canonicalUrl: 'https://example.com/story',
          citations: [
            {
              sourceId: 'ai-news',
              sourceName: 'AI News',
              url: 'https://example.com/story',
            },
          ],
          headline: 'Major AI story advances',
          importanceScore: 0.86,
          personalScore: 0.92,
          publishedAt: '2026-04-04T18:00:00.000Z',
          stories: [
            {
              storyId: 'story_1',
              clusterId: 'cluster_1',
              canonicalUrl: 'https://example.com/story',
              bodyText: 'Detailed article body text.',
              sourceId: 'ai-news',
              sourceName: 'AI News',
              sourceType: 'watchlist',
              publishedAt: '2026-04-04T18:00:00.000Z',
              summary: 'A major AI story advanced.',
              title: 'Major AI story advances',
              topics: ['ai'],
              regions: ['global'],
              citations: [
                {
                  sourceId: 'ai-news',
                  sourceName: 'AI News',
                  url: 'https://example.com/story',
                },
              ],
              importanceScore: 0.86,
              personalScore: 0.92,
            },
          ],
          storyIds: ['story_1'],
        },
      ],
      {
        client: mongo.client,
        dbName: mongo.dbName,
        generatedAt: '2026-04-04T18:30:00.000Z',
      },
    );

    const storyState = await loadStoriesFromMongo({
      client: mongo.client,
      dbName: mongo.dbName,
      limit: 5,
    });
    const clusterState = await loadStoryClustersFromMongo({
      client: mongo.client,
      dbName: mongo.dbName,
      limit: 5,
    });

    expect(storyState.stories).toHaveLength(1);
    expect(storyState.stories[0]).toMatchObject({
      storyId: 'story_1',
      bodyText: 'Detailed article body text.',
      title: 'Major AI story advances',
    });
    expect(clusterState.clusters).toHaveLength(1);
    expect(clusterState.clusters[0]).toMatchObject({
      clusterId: 'cluster_1',
      headline: 'Major AI story advances',
      storyIds: ['story_1'],
    });
    expect(storyState.storageTarget).toContain(
      getMongoCollectionNames().stories,
    );
    expect(clusterState.storageTarget).toContain(
      getMongoCollectionNames().storyClusters,
    );
  });
});

describe('podcast run mongo storage', () => {
  it('stores and reloads podcast runs in descending generated order', async () => {
    const mongo = await createMongoTestContext();
    cleanupTasks.push(mongo.cleanup);

    const first = await savePodcastRunToMongo(
      {
        audioPath:
          '/Users/gersham/Sources/personal/NewsAggregator/artifacts/briefings/2026-04-04/morning-briefing.mp3',
        date: '2026-04-04',
        generatedAt: '2026-04-04T14:00:00.000Z',
        transcriptPath:
          '/Users/gersham/Sources/personal/NewsAggregator/artifacts/briefings/2026-04-04/morning-briefing.txt',
      },
      {
        client: mongo.client,
        dbName: mongo.dbName,
      },
    );
    const second = await savePodcastRunToMongo(
      {
        audioPath:
          '/Users/gersham/Sources/personal/NewsAggregator/artifacts/briefings/2026-04-05/morning-briefing.mp3',
        date: '2026-04-05',
        generatedAt: '2026-04-05T14:00:00.000Z',
        transcriptPath:
          '/Users/gersham/Sources/personal/NewsAggregator/artifacts/briefings/2026-04-05/morning-briefing.txt',
      },
      {
        client: mongo.client,
        dbName: mongo.dbName,
      },
    );

    const state = await loadPodcastRunsFromMongo({
      client: mongo.client,
      dbName: mongo.dbName,
      limit: 10,
    });

    expect(state.runs).toHaveLength(2);
    expect(state.runs[0]).toMatchObject({
      runId: second.run.runId,
      date: '2026-04-05',
    });
    expect(state.runs[1]).toMatchObject({
      runId: first.run.runId,
      date: '2026-04-04',
    });
    expect(state.storageTarget).toContain(
      getMongoCollectionNames().podcastRuns,
    );
  });
});
