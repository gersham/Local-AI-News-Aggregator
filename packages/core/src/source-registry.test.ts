import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getArticleBodyStrategy,
  getRunnableSources,
  readSourceRegistryFromFile,
  upsertSourceDefinition,
  writeSourceRegistryToFile,
} from './index';

describe('readSourceRegistryFromFile', () => {
  it('loads and validates a source registry from disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'news-registry-'));
    const file = join(dir, 'sources.json');

    writeFileSync(
      file,
      JSON.stringify({
        sources: [
          {
            id: 'hacker-news-home',
            name: 'Hacker News Homepage',
            type: 'news-site',
            fetchMethod: 'http',
            enabled: true,
            schedule: '*/30 * * * *',
            topics: ['tech', 'ai'],
            regions: ['global'],
            baseWeight: 0.78,
            trustWeight: 0.82,
          },
        ],
      }),
    );

    const registry = readSourceRegistryFromFile(file);

    expect(registry.sources).toHaveLength(1);
    expect(registry.sources[0]?.id).toBe('hacker-news-home');

    rmSync(dir, { recursive: true, force: true });
  });

  it('ships a default registry example that includes Hacker News', () => {
    const text = readFileSync(
      join(process.cwd(), '../../config/sources.example.json'),
      'utf8',
    );

    expect(text).toContain('"id": "hacker-news-home"');
  });

  it('defers browser-auth Reddit scraping by default', () => {
    const registry = readSourceRegistryFromFile(
      join(process.cwd(), '../../config/sources.example.json'),
    );

    const reddit = registry.sources.find(
      (source) => source.id === 'reddit-home',
    );
    const runnableIds = getRunnableSources(registry).map((source) => source.id);

    expect(reddit).toMatchObject({
      id: 'reddit-home',
      enabled: false,
      executionMode: 'manual-opt-in',
      fetchMethod: 'browser-scrape',
      requiresAuthentication: true,
    });
    expect(runnableIds).not.toContain('reddit-home');
    expect(runnableIds).toContain('x-my-feed');
  });
});

describe('getArticleBodyStrategy', () => {
  it('prefers Exa for public article extraction', () => {
    const strategy = getArticleBodyStrategy({
      requiresAuthentication: false,
      prefersBrowser: false,
      url: 'https://example.com/story',
    });

    expect(strategy.primary).toBe('exa-contents');
    expect(strategy.fallbacks).toEqual(['direct-http', 'browser-scrape']);
  });

  it('uses browser scraping first for authenticated sources', () => {
    const strategy = getArticleBodyStrategy({
      requiresAuthentication: true,
      prefersBrowser: true,
      url: 'https://reddit.com/',
    });

    expect(strategy.primary).toBe('browser-scrape');
    expect(strategy.fallbacks).toEqual([]);
  });
});

describe('source registry persistence helpers', () => {
  it('upserts a source definition by id', () => {
    const source = {
      id: 'hacker-news-home',
      name: 'Hacker News Homepage',
      type: 'news-site' as const,
      fetchMethod: 'http' as const,
      enabled: true,
      executionMode: 'active' as const,
      requiresAuthentication: false,
      schedule: '*/30 * * * *',
      topics: ['tech', 'ai'],
      regions: ['global'],
      seedUrls: [],
      baseWeight: 0.78,
      trustWeight: 0.82,
    };
    const registry = {
      sources: [source],
    };

    const updated = upsertSourceDefinition(registry, {
      ...source,
      enabled: false,
      executionMode: 'manual-opt-in',
    });

    expect(updated.sources).toHaveLength(1);
    expect(updated.sources[0]).toMatchObject({
      id: 'hacker-news-home',
      enabled: false,
      executionMode: 'manual-opt-in',
    });
  });

  it('writes validated registry data to disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'news-registry-write-'));
    const file = join(dir, 'sources.json');

    writeSourceRegistryToFile(file, {
      sources: [
        {
          id: 'hacker-news-home',
          name: 'Hacker News Homepage',
          type: 'news-site',
          fetchMethod: 'http',
          enabled: true,
          executionMode: 'active',
          requiresAuthentication: false,
          schedule: '*/30 * * * *',
          topics: ['tech', 'ai'],
          regions: ['global'],
          seedUrls: [],
          baseWeight: 0.78,
          trustWeight: 0.82,
        },
      ],
    });

    const saved = readFileSync(file, 'utf8');

    expect(saved).toContain('"executionMode": "active"');
    expect(saved.endsWith('\n')).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });
});
