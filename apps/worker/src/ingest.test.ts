import { buildSourceFixture } from '@news-aggregator/test-utils';
import { describe, expect, it } from 'vitest';
import type { ExaContentsResponse } from './exa';
import { runIngestCommand } from './ingest';

describe('runIngestCommand', () => {
  it('returns an ingestion summary after persisting feed and run data', async () => {
    const persistedArtifacts: string[] = [];
    const persistedClusters: string[] = [];
    const persistedRuns: string[] = [];
    const persistedStories: string[] = [];

    const summary = await runIngestCommand(
      {
        registry: {
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
        },
      },
      {
        fetchExaContents: async (
          urls: string[],
        ): Promise<ExaContentsResponse> => ({
          requestId: 'exa_contents_456',
          results: urls.map((url: string) => ({
            publishedDate: '2026-04-04T15:10:00.000Z',
            summary: `Summary for ${url}`,
            text: `Full article text for ${url}`,
            title: 'BC transit funding debate widens',
            url,
          })),
          statuses: urls.map((url: string) => ({
            id: url,
            status: 'success',
          })),
        }),
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
        persistFeedSnapshot: async () => undefined,
        persistIngestRun: async () => {
          const runId = `run_${persistedRuns.length + 1}`;
          persistedRuns.push(runId);

          return {
            runId,
          };
        },
      },
    );

    expect(summary.discoveryCount).toBe(1);
    expect(summary.feedSnapshot.entries).toHaveLength(1);
    expect(summary.clusterCount).toBe(1);
    expect(summary.rawArtifactIds).toEqual(['artifact_1']);
    expect(summary.runId).toBe('run_1');
    expect(persistedStories).toHaveLength(1);
    expect(persistedClusters).toEqual([
      summary.feedSnapshot.entries[0]?.clusterId,
    ]);
  });
});
