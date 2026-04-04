import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GET, PATCH } from './route';

const tempRoots: string[] = [];

afterEach(() => {
  delete process.env.SOURCE_REGISTRY_PATH;
  delete process.env.SOURCE_REGISTRY_EXAMPLE_PATH;

  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function seedRegistryRoot() {
  const root = join(tmpdir(), `news-api-route-${Date.now()}`);
  tempRoots.push(root);
  mkdirSync(join(root, 'config'), { recursive: true });

  const examplePath = join(root, 'config', 'sources.example.json');

  writeFileSync(
    examplePath,
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

  process.env.SOURCE_REGISTRY_PATH = join(root, 'data', 'sources.json');
  process.env.SOURCE_REGISTRY_EXAMPLE_PATH = examplePath;

  return root;
}

describe('GET /api/sources', () => {
  it('returns the current source registry with fallback metadata', async () => {
    seedRegistryRoot();

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.usingExampleFallback).toBe(true);
    expect(payload.registry.sources[0]?.id).toBe('reddit-home');
  });
});

describe('PATCH /api/sources', () => {
  it('updates a stored source definition', async () => {
    seedRegistryRoot();

    const response = await PATCH(
      new Request('http://localhost/api/sources', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          id: 'reddit-home',
          enabled: true,
          executionMode: 'active',
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.usingExampleFallback).toBe(false);
    expect(payload.registry.sources[0]).toMatchObject({
      id: 'reddit-home',
      enabled: true,
      executionMode: 'active',
    });
  });
});
