import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSourceFixture } from '@news-aggregator/test-utils';
import { describe, expect, it } from 'vitest';
import {
  buildPublicSourceFetchPlans,
  executePublicSourceFetchPlan,
  writePublicSourceArtifact,
} from './public-sources';

describe('buildPublicSourceFetchPlans', () => {
  it('includes only active public discovery sources with complete config', () => {
    const plans = buildPublicSourceFetchPlans({
      sources: [
        buildSourceFixture({
          id: 'hn-home',
          fetchMethod: 'http',
          seedUrls: ['https://news.ycombinator.com/'],
        }),
        buildSourceFixture({
          id: 'bc-news-rss',
          fetchMethod: 'rss',
          rssUrl: 'https://example.com/feed.xml',
        }),
        buildSourceFixture({
          id: 'reddit-home',
          fetchMethod: 'browser-scrape',
          enabled: false,
          executionMode: 'manual-opt-in',
          requiresAuthentication: true,
        }),
        buildSourceFixture({
          id: 'x-my-feed',
          type: 'social',
          fetchMethod: 'x-search',
          query: 'ai news',
        }),
      ],
    });

    expect(plans).toHaveLength(2);
    expect(plans).toEqual([
      {
        artifactKey: 'discovery-http',
        kind: 'http-text',
        sourceId: 'hn-home',
        target: 'https://news.ycombinator.com/',
      },
      {
        artifactKey: 'discovery-rss',
        kind: 'http-text',
        sourceId: 'bc-news-rss',
        target: 'https://example.com/feed.xml',
      },
    ]);
  });
});

describe('executePublicSourceFetchPlan', () => {
  it('fetches text content for HTTP plans', async () => {
    const result = await executePublicSourceFetchPlan(
      {
        artifactKey: 'discovery-http',
        kind: 'http-text',
        sourceId: 'hn-home',
        target: 'https://news.ycombinator.com/',
      },
      {
        fetchText: async (url) => {
          expect(url).toBe('https://news.ycombinator.com/');

          return '<html>hn</html>';
        },
      },
    );

    expect(result).toMatchObject({
      artifactKey: 'discovery-http',
      content: '<html>hn</html>',
      sourceId: 'hn-home',
      target: 'https://news.ycombinator.com/',
    });
  });
});

describe('writePublicSourceArtifact', () => {
  it('writes raw artifacts under a dated source directory', async () => {
    const artifactRoot = join(tmpdir(), `news-artifacts-${Date.now()}`);

    const path = await writePublicSourceArtifact({
      artifactRoot,
      content: '<rss />',
      extension: 'xml',
      fetchedAt: '2026-04-04T16:00:00.000Z',
      sourceId: 'bc-news-rss',
      stage: 'discovery-rss',
    });

    expect(existsSync(path)).toBe(true);
    expect(path).toContain(
      join('2026-04-04', 'bc-news-rss', 'discovery-rss.xml'),
    );
    expect(readFileSync(path, 'utf8')).toBe('<rss />');

    rmSync(artifactRoot, { recursive: true, force: true });
  });
});
