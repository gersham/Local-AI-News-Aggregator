import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadPersistedSourceRegistry,
  resolveSourceRegistryPaths,
  updateStoredSourceDefinition,
} from './source-registry-store';

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('resolveSourceRegistryPaths', () => {
  it('derives writable and example paths from the project root', () => {
    const root = join(tmpdir(), 'news-registry-paths');
    const paths = resolveSourceRegistryPaths({ projectRoot: root });

    expect(paths.storagePath).toBe(join(root, 'data', 'sources.json'));
    expect(paths.examplePath).toBe(
      join(root, 'config', 'sources.example.json'),
    );
  });
});

describe('loadPersistedSourceRegistry', () => {
  it('falls back to the example registry when no writable file exists', async () => {
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

    const result = await loadPersistedSourceRegistry({ projectRoot: root });

    expect(result.usingExampleFallback).toBe(true);
    expect(result.registry.sources[0]?.id).toBe('x-my-feed');
  });
});

describe('updateStoredSourceDefinition', () => {
  it('persists a source update into the writable registry file', async () => {
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

    const result = await updateStoredSourceDefinition({
      projectRoot: root,
      id: 'reddit-home',
      patch: {
        enabled: true,
        executionMode: 'active',
      },
    });

    expect(result.usingExampleFallback).toBe(false);
    expect(result.registry.sources[0]).toMatchObject({
      id: 'reddit-home',
      enabled: true,
      executionMode: 'active',
    });
    expect(existsSync(join(root, 'data', 'sources.json'))).toBe(true);
  });
});
