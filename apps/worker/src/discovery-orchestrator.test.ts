import { buildSourceFixture } from '@news-aggregator/test-utils';
import { describe, expect, it } from 'vitest';
import {
  extractDiscoveryCandidates,
  runDiscoveryEnrichmentOrchestrator,
} from './discovery-orchestrator';
import type { ExaContentsResponse } from './exa';

describe('extractDiscoveryCandidates', () => {
  it('extracts candidates from RSS, Hacker News HTML, Exa search, and xAI search', () => {
    const rssSource = buildSourceFixture({
      id: 'bc-rss',
      name: 'BC RSS',
      fetchMethod: 'rss',
      rssUrl: 'https://example.com/feed.xml',
      topics: ['bc'],
      regions: ['bc'],
    });
    const hnSource = buildSourceFixture({
      id: 'hn-home',
      name: 'Hacker News',
      fetchMethod: 'http',
      seedUrls: ['https://news.ycombinator.com/'],
      topics: ['tech'],
      regions: ['global'],
    });
    const exaSource = buildSourceFixture({
      id: 'bc-search',
      name: 'BC Search',
      fetchMethod: 'exa-search',
      query: 'latest bc news',
      topics: ['bc'],
      regions: ['bc'],
    });
    const xSource = buildSourceFixture({
      id: 'x-feed',
      name: 'My X Feed',
      type: 'social',
      fetchMethod: 'x-search',
      query: 'ai news',
      topics: ['ai'],
      regions: ['global'],
    });

    const candidates = extractDiscoveryCandidates({
      publicArtifacts: [
        {
          artifact: {
            artifactKey: 'discovery-rss',
            content: `<?xml version="1.0" encoding="UTF-8"?>
              <rss version="2.0">
                <channel>
                  <title>BC News</title>
                  <item>
                    <title>Lantzville approves waterfront plan</title>
                    <link>https://example.com/lantzville-waterfront</link>
                    <pubDate>Sat, 04 Apr 2026 15:00:00 GMT</pubDate>
                    <description>Council approved the waterfront plan update.</description>
                  </item>
                </channel>
              </rss>`,
            fetchedAt: '2026-04-04T15:05:00.000Z',
            sourceId: 'bc-rss',
            target: 'https://example.com/feed.xml',
          },
          source: rssSource,
        },
        {
          artifact: {
            artifactKey: 'discovery-http',
            content: `
              <html>
                <body>
                  <tr class="athing">
                    <td class="title">
                      <span class="titleline">
                        <a href="https://example.com/hn-story">HN story</a>
                      </span>
                    </td>
                  </tr>
                  <tr class="athing">
                    <td class="title">
                      <span class="titleline">
                        <a href="from?site=example.com">Submissions from example.com</a>
                      </span>
                    </td>
                  </tr>
                </body>
              </html>`,
            fetchedAt: '2026-04-04T15:05:00.000Z',
            sourceId: 'hn-home',
            target: 'https://news.ycombinator.com/',
          },
          source: hnSource,
        },
        {
          artifact: {
            artifactKey: 'discovery-exa-search',
            content: JSON.stringify({
              results: [
                {
                  publishedDate: '2026-04-04T14:30:00.000Z',
                  summary: 'Provincial politics and transport updates.',
                  title: 'BC transit funding debate widens',
                  url: 'https://example.com/bc-transit',
                },
              ],
            }),
            fetchedAt: '2026-04-04T15:05:00.000Z',
            sourceId: 'bc-search',
            target: 'latest bc news',
          },
          source: exaSource,
        },
      ],
      xSearchResults: [
        {
          result: {
            content: {
              output_text: JSON.stringify({
                stories: [
                  {
                    publishedAt: '2026-04-04T14:45:00.000Z',
                    regions: ['global'],
                    summary: 'AI datacenter spending continues climbing.',
                    title: 'AI datacenter buildout accelerates',
                    topics: ['ai'],
                    url: 'https://example.com/ai-datacenter',
                  },
                ],
              }),
            },
            sourceId: 'x-feed',
          },
          source: xSource,
        },
      ],
    });

    expect(candidates).toHaveLength(4);
    expect(candidates.map((candidate) => candidate.title)).toEqual([
      'Lantzville approves waterfront plan',
      'HN story',
      'BC transit funding debate widens',
      'AI datacenter buildout accelerates',
    ]);
    expect(candidates[0]).toMatchObject({
      discoveryKind: 'rss-item',
      url: 'https://example.com/lantzville-waterfront',
    });
    expect(candidates[1]).toMatchObject({
      discoveryKind: 'homepage-link',
      url: 'https://example.com/hn-story',
    });
  });

  it('drops obvious landing pages from Exa search discovery candidates', () => {
    const exaSource = buildSourceFixture({
      id: 'bc-search',
      name: 'BC Search',
      fetchMethod: 'exa-search',
      query: 'latest bc news',
      topics: ['bc'],
      regions: ['bc'],
    });

    const candidates = extractDiscoveryCandidates({
      publicArtifacts: [
        {
          artifact: {
            artifactKey: 'discovery-exa-search',
            content: JSON.stringify({
              results: [
                {
                  publishedDate: '2026-04-04T14:30:00.000Z',
                  summary: 'Local news landing page.',
                  title: 'Vancouver: Local News, Weather & Traffic Updates',
                  url: 'https://www.ctvnews.ca/vancouver',
                },
                {
                  publishedDate: '2026-04-04T13:00:00.000Z',
                  summary: 'A specific article about a bridge reopening.',
                  title:
                    'Barge-damaged Delta bridge reopening to traffic after repairs',
                  url: 'https://www.ctvnews.ca/vancouver/article/barge-damaged-delta-bridge-reopening-to-traffic-after-repairs',
                },
              ],
            }),
            fetchedAt: '2026-04-04T15:05:00.000Z',
            sourceId: 'bc-search',
            target: 'latest bc news',
          },
          source: exaSource,
        },
      ],
      xSearchResults: [],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.url).toBe(
      'https://www.ctvnews.ca/vancouver/article/barge-damaged-delta-bridge-reopening-to-traffic-after-repairs',
    );
  });

  it('drops section and topic index pages even when Exa returns them with article-like summaries', () => {
    const exaSource = buildSourceFixture({
      id: 'canada-search',
      name: 'Canada News',
      fetchMethod: 'exa-search',
      query: 'latest canada news',
      topics: ['canada'],
      regions: ['canada'],
    });

    const candidates = extractDiscoveryCandidates({
      publicArtifacts: [
        {
          artifact: {
            artifactKey: 'discovery-exa-search',
            content: JSON.stringify({
              results: [
                {
                  publishedDate: '2026-04-04T14:30:00.000Z',
                  summary:
                    'A page collecting Canada news coverage and explainers.',
                  title: 'Canada | News and latest headlines',
                  url: 'https://www.cbc.ca/news/canada',
                },
                {
                  publishedDate: '2026-04-04T13:00:00.000Z',
                  summary:
                    'Federal officials announced a new interprovincial trade package.',
                  title:
                    'Federal government unveils new interprovincial trade package',
                  url: 'https://www.cbc.ca/news/politics/interprovincial-trade-package-1.7512345',
                },
              ],
            }),
            fetchedAt: '2026-04-04T15:05:00.000Z',
            sourceId: 'canada-search',
            target: 'latest canada news',
          },
          source: exaSource,
        },
      ],
      xSearchResults: [],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.url).toBe(
      'https://www.cbc.ca/news/politics/interprovincial-trade-package-1.7512345',
    );
  });

  it('drops category and tag index pages from Exa discovery results', () => {
    const exaSource = buildSourceFixture({
      id: 'tech-search',
      name: 'Tech News',
      fetchMethod: 'exa-search',
      query: 'latest tech news',
      topics: ['tech'],
      regions: ['global'],
    });

    const candidates = extractDiscoveryCandidates({
      publicArtifacts: [
        {
          artifact: {
            artifactKey: 'discovery-exa-search',
            content: JSON.stringify({
              results: [
                {
                  publishedDate: '2026-04-04T14:30:00.000Z',
                  summary:
                    'A category page tracking the latest AI and tech headlines.',
                  title: 'AI category archive',
                  url: 'https://example.com/category/ai',
                },
                {
                  publishedDate: '2026-04-04T13:00:00.000Z',
                  summary:
                    'New chip export controls are reshaping Asian supply-chain planning.',
                  title: 'New chip export controls reshape Asian supply chains',
                  url: 'https://example.com/2026/04/04/chip-export-controls-asia',
                },
              ],
            }),
            fetchedAt: '2026-04-04T15:05:00.000Z',
            sourceId: 'tech-search',
            target: 'latest tech news',
          },
          source: exaSource,
        },
      ],
      xSearchResults: [],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.url).toBe(
      'https://example.com/2026/04/04/chip-export-controls-asia',
    );
  });
});

describe('runDiscoveryEnrichmentOrchestrator', () => {
  it('builds a fresh feed snapshot from discovery and Exa-first enrichment', async () => {
    const persistedArtifacts: string[] = [];
    const registry = {
      sources: [
        buildSourceFixture({
          id: 'hn-home',
          name: 'Hacker News',
          fetchMethod: 'http',
          seedUrls: ['https://news.ycombinator.com/'],
          topics: ['tech'],
          regions: ['global'],
        }),
        buildSourceFixture({
          id: 'bc-search',
          name: 'BC Search',
          fetchMethod: 'exa-search',
          query: 'latest bc news',
          topics: ['bc'],
          regions: ['bc'],
        }),
        buildSourceFixture({
          id: 'x-feed',
          name: 'My X Feed',
          type: 'social',
          fetchMethod: 'x-search',
          query: 'ai news',
          topics: ['ai'],
          regions: ['global'],
        }),
      ],
    };

    const result = await runDiscoveryEnrichmentOrchestrator(
      {
        now: () => new Date('2026-04-04T16:00:00.000Z'),
        registry,
      },
      {
        executeXSearchPlan: async () => ({
          content: {
            output_text: JSON.stringify({
              stories: [
                {
                  publishedAt: '2026-04-04T15:20:00.000Z',
                  summary:
                    'Model releases and datacenter funding remain elevated.',
                  title: 'AI funding climbs again',
                  topics: ['ai'],
                  url: 'https://example.com/ai-funding',
                },
              ],
            }),
          },
          sourceId: 'x-feed',
        }),
        fetchExaContents: async (urls): Promise<ExaContentsResponse> => ({
          requestId: 'exa_contents_123',
          results: urls.map((url) => ({
            publishedDate: '2026-04-04T15:10:00.000Z',
            summary: `Summary for ${url}`,
            text: `Full article text for ${url}`,
            title:
              url === 'https://example.com/hn-deep-dive'
                ? 'HN deep dive'
                : url === 'https://example.com/bc-transit'
                  ? 'BC transit funding debate widens'
                  : 'AI funding climbs again',
            url,
          })),
          statuses: urls.map((url) => ({
            id: url,
            status: 'success',
          })),
        }),
        fetchText: async (url) => {
          if (url === 'https://news.ycombinator.com/') {
            return `
              <html>
                <body>
                  <tr class="athing">
                    <td class="title">
                      <span class="titleline">
                        <a href="https://example.com/hn-deep-dive">HN deep dive</a>
                      </span>
                    </td>
                  </tr>
                </body>
              </html>`;
          }

          throw new Error(`Unexpected fetchText URL: ${url}`);
        },
        searchExa: async () => ({
          results: [
            {
              publishedDate: '2026-04-04T14:00:00.000Z',
              summary: 'BC regional developments continue.',
              title: 'BC transit funding debate widens',
              url: 'https://example.com/bc-transit',
            },
          ],
        }),
        persistDiscoveryArtifact: async () => {
          const artifactId = `artifact_${persistedArtifacts.length + 1}`;
          persistedArtifacts.push(artifactId);

          return {
            artifactId,
          };
        },
        persistFeedSnapshot: async () => undefined,
        persistIngestRun: async () => ({
          runId: 'run_1',
        }),
        persistStoryClusters: async () => ({
          storedCount: 3,
        }),
        persistStories: async () => ({
          storedCount: 3,
        }),
      },
    );

    expect(result.discoveryCount).toBe(3);
    expect(result.enrichedStoryCount).toBe(3);
    expect(result.feedSnapshot.entries).toHaveLength(3);
    expect(result.feedSnapshot.entries[0]?.summary).toContain(
      'Full article text for',
    );
    expect(result.rawArtifactIds).toEqual(['artifact_1', 'artifact_2']);
    expect(result.runId).toBe('run_1');
  });

  it('matches normalized Exa article URLs back to tracked discovery URLs', async () => {
    const registry = {
      sources: [
        buildSourceFixture({
          id: 'bc-search',
          name: 'BC Search',
          fetchMethod: 'exa-search',
          query: 'latest bc news',
          topics: ['bc'],
          regions: ['bc'],
        }),
      ],
    };

    const result = await runDiscoveryEnrichmentOrchestrator(
      {
        now: () => new Date('2026-04-04T16:00:00.000Z'),
        registry,
      },
      {
        fetchExaContents: async (): Promise<ExaContentsResponse> => ({
          requestId: 'exa_contents_456',
          results: [
            {
              publishedDate: '2026-04-04T15:10:00.000Z',
              summary: 'Normalized article body won over discovery summary.',
              text: 'Normalized article body won over discovery summary.',
              title: 'Tracked BC article',
              url: 'https://example.com/bc-transit',
            },
          ],
          statuses: [
            {
              id: 'https://example.com/bc-transit',
              status: 'success',
            },
          ],
        }),
        persistDiscoveryArtifact: async () => ({
          artifactId: 'artifact_1',
        }),
        persistFeedSnapshot: async () => undefined,
        persistIngestRun: async () => ({
          runId: 'run_1',
        }),
        persistStoryClusters: async () => ({
          storedCount: 1,
        }),
        persistStories: async () => ({
          storedCount: 1,
        }),
        searchExa: async () => ({
          results: [
            {
              publishedDate: '2026-04-04T14:00:00.000Z',
              summary: 'Discovery summary should be replaced.',
              title: 'Tracked BC article',
              url: 'https://example.com/bc-transit?utm_source=exa',
            },
          ],
        }),
      },
    );

    expect(result.feedSnapshot.entries).toHaveLength(1);
    expect(result.feedSnapshot.entries[0]?.summary).toContain(
      'Normalized article body won over discovery summary.',
    );
  });

  it('prefers Exa body text over Exa summary when building feed summaries', async () => {
    const registry = {
      sources: [
        buildSourceFixture({
          id: 'canada-search',
          name: 'Canada News',
          fetchMethod: 'exa-search',
          query: 'latest canada news',
          topics: ['canada'],
          regions: ['canada'],
        }),
      ],
    };

    const result = await runDiscoveryEnrichmentOrchestrator(
      {
        now: () => new Date('2026-04-04T16:00:00.000Z'),
        registry,
      },
      {
        fetchExaContents: async (): Promise<ExaContentsResponse> => ({
          requestId: 'exa_contents_900',
          results: [
            {
              publishedDate: '2026-04-04T15:10:00.000Z',
              summary:
                'This weak provider summary should not be the feed copy.',
              text: 'Prime Minister announces a new federal housing package after emergency cabinet talks.',
              title: 'Federal housing package announced',
              url: 'https://example.com/canada-housing',
            },
          ],
          statuses: [
            {
              id: 'https://example.com/canada-housing',
              status: 'success',
            },
          ],
        }),
        persistDiscoveryArtifact: async () => ({
          artifactId: 'artifact_1',
        }),
        persistFeedSnapshot: async () => undefined,
        persistIngestRun: async () => ({
          runId: 'run_1',
        }),
        persistStoryClusters: async () => ({
          storedCount: 1,
        }),
        persistStories: async () => ({
          storedCount: 1,
        }),
        searchExa: async () => ({
          results: [
            {
              publishedDate: '2026-04-04T14:00:00.000Z',
              summary: 'Discovery summary should be replaced.',
              title: 'Federal housing package announced',
              url: 'https://example.com/canada-housing',
            },
          ],
        }),
      },
    );

    expect(result.feedSnapshot.entries).toHaveLength(1);
    expect(result.feedSnapshot.entries[0]?.summary).toContain(
      'Prime Minister announces a new federal housing package',
    );
    expect(result.feedSnapshot.entries[0]?.summary).not.toContain(
      'weak provider summary',
    );
  });

  it('persists normalized stories and clusters when those sinks are provided', async () => {
    const registry = {
      sources: [
        buildSourceFixture({
          id: 'bc-search',
          name: 'BC Search',
          fetchMethod: 'exa-search',
          query: 'latest bc news',
          topics: ['bc'],
          regions: ['bc'],
        }),
      ],
    };
    const persistedStories: string[] = [];
    const persistedClusters: string[] = [];

    const result = await runDiscoveryEnrichmentOrchestrator(
      {
        now: () => new Date('2026-04-04T16:00:00.000Z'),
        registry,
      },
      {
        fetchExaContents: async (): Promise<ExaContentsResponse> => ({
          requestId: 'exa_contents_789',
          results: [
            {
              publishedDate: '2026-04-04T15:10:00.000Z',
              summary: 'Detailed body copy for a BC transportation article.',
              text: 'Detailed body copy for a BC transportation article.',
              title: 'Tracked BC article',
              url: 'https://example.com/bc-transit',
            },
          ],
          statuses: [
            {
              id: 'https://example.com/bc-transit',
              status: 'success',
            },
          ],
        }),
        persistDiscoveryArtifact: async () => ({
          artifactId: 'artifact_1',
        }),
        persistFeedSnapshot: async () => undefined,
        persistIngestRun: async () => ({
          runId: 'run_1',
        }),
        persistStoryClusters: async (clusters) => {
          persistedClusters.push(
            ...clusters.map((cluster) => cluster.clusterId),
          );

          return {
            storedCount: clusters.length,
          };
        },
        persistStories: async (stories) => {
          persistedStories.push(...stories.map((story) => story.storyId));

          return {
            storedCount: stories.length,
          };
        },
        searchExa: async () => ({
          results: [
            {
              publishedDate: '2026-04-04T14:00:00.000Z',
              summary: 'Tracked BC article summary.',
              title: 'Tracked BC article',
              url: 'https://example.com/bc-transit',
            },
          ],
        }),
      },
    );

    expect(result.enrichedStoryCount).toBe(1);
    expect(result.clusterCount).toBe(1);
    expect(persistedStories).toHaveLength(1);
    expect(persistedClusters).toEqual([
      result.feedSnapshot.entries[0]?.clusterId,
    ]);
  });
});
