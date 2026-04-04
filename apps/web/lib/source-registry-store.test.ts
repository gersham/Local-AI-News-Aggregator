import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMongoTestContext } from '@news-aggregator/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadPersistedSourceRegistry,
  resolveSourceRegistryPaths,
  updateStoredSourceDefinition,
} from './source-registry-store';

const tempRoots: string[] = [];
const cleanupTasks: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }

  for (const cleanup of cleanupTasks.splice(0)) {
    await cleanup();
  }
});

describe('resolveSourceRegistryPaths', () => {
  it('derives legacy-import and example paths from the project root', () => {
    const root = join(tmpdir(), 'news-registry-paths');
    const paths = resolveSourceRegistryPaths({ projectRoot: root });

    expect(paths.legacyPath).toBe(join(root, 'data', 'sources.json'));
    expect(paths.examplePath).toBe(
      join(root, 'config', 'sources.example.json'),
    );
  });
});

describe('loadPersistedSourceRegistry', () => {
  it('falls back to the example registry when Mongo is empty', async () => {
    const root = join(tmpdir(), `news-registry-load-${Date.now()}`);
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

    const result = await loadPersistedSourceRegistry({
      dbName: mongo.dbName,
      projectRoot: root,
      uri: mongo.uri,
    });

    expect(result.usingExampleFallback).toBe(true);
    expect(result.registry.sources[0]?.id).toBe('x-my-feed');
  });
});

describe('updateStoredSourceDefinition', () => {
  it('persists a source update into MongoDB state', async () => {
    const root = join(tmpdir(), `news-registry-update-${Date.now()}`);
    tempRoots.push(root);
    mkdirSync(join(root, 'config'), { recursive: true });

    writeFileSync(
      join(root, 'config', 'sources.example.json'),
      JSON.stringify({
        sources: [
          {
            id: 'reddit-home',
            name: 'My Reddit Feed',
            type: 'social',
            fetchMethod: 'browser-scrape',
            enabled: false,
            executionMode: 'manual-opt-in',
            requiresAuthentication: true,
            schedule: '*/20 * * * *',
            topics: ['ai'],
            regions: ['global'],
            baseWeight: 0.9,
            trustWeight: 0.7,
          },
        ],
      }),
    );

    const mongo = await createMongoTestContext();
    cleanupTasks.push(mongo.cleanup);

    const result = await updateStoredSourceDefinition({
      dbName: mongo.dbName,
      projectRoot: root,
      id: 'reddit-home',
      patch: {
        enabled: true,
        executionMode: 'active',
      },
      uri: mongo.uri,
    });

    expect(result.usingExampleFallback).toBe(false);
    expect(result.registry.sources[0]).toMatchObject({
      id: 'reddit-home',
      enabled: true,
      executionMode: 'active',
    });
    expect(result.storageTarget).toContain(mongo.dbName);
  });

  it('persists editable source definition fields into MongoDB state', async () => {
    const root = join(tmpdir(), `news-registry-edit-${Date.now()}`);
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
            topics: ['bc', 'canada'],
            regions: ['bc', 'canada'],
            query: 'latest British Columbia Vancouver Canada news',
            additionalQueries: [],
            includeDomains: ['cbc.ca'],
            excludeDomains: ['facebook.com'],
            exaCategory: 'news',
            exaNumResults: 20,
            exaSearchType: 'deep',
            exaUserLocation: 'ca',
            baseWeight: 0.88,
            trustWeight: 0.85,
          },
        ],
      }),
    );

    const mongo = await createMongoTestContext();
    cleanupTasks.push(mongo.cleanup);

    const result = await updateStoredSourceDefinition({
      dbName: mongo.dbName,
      projectRoot: root,
      id: 'bc-news-search',
      patch: {
        additionalQueries: ['Vancouver breaking news past 24 hours'],
        baseWeight: 0.91,
        excludeDomains: ['facebook.com', 'youtube.com'],
        includeDomains: ['cbc.ca', 'globalnews.ca'],
        query: 'latest BC local news',
        regions: ['bc', 'vancouver'],
        topics: ['bc', 'vancouver', 'local'],
        trustWeight: 0.9,
      },
      uri: mongo.uri,
    });

    expect(result.registry.sources[0]).toMatchObject({
      id: 'bc-news-search',
      additionalQueries: ['Vancouver breaking news past 24 hours'],
      baseWeight: 0.91,
      excludeDomains: ['facebook.com', 'youtube.com'],
      includeDomains: ['cbc.ca', 'globalnews.ca'],
      query: 'latest BC local news',
      regions: ['bc', 'vancouver'],
      topics: ['bc', 'vancouver', 'local'],
      trustWeight: 0.9,
    });
    expect(result.storageTarget).toContain(mongo.dbName);
  });
});
