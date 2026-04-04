import { resolve } from 'node:path';
import {
  loadSourceRegistryFromMongo,
  type SourceRegistry,
  saveDiscoveryArtifactToMongo,
  saveIngestRunToMongo,
} from '@news-aggregator/core';
import {
  type DiscoveryOrchestratorDependencies,
  type IngestionSummary,
  runDiscoveryEnrichmentOrchestrator,
} from './discovery-orchestrator';
import { fetchExaContents, searchExa } from './exa';
import { writeFeedSnapshot } from './feed-materializer';

export async function runIngestCommand(
  input: {
    artifactRoot?: string;
    dbName?: string;
    feedSnapshotLegacyPath?: string;
    registry?: SourceRegistry;
    registryExamplePath?: string;
    registryLegacyPath?: string;
    sourceRegistryExamplePath?: string;
    uri?: string;
  } = {},
  dependencies: DiscoveryOrchestratorDependencies = {},
): Promise<IngestionSummary> {
  const projectRoot = resolve(process.cwd(), '../..');
  const registryLegacyPath =
    input.registryLegacyPath ??
    process.env.SOURCE_REGISTRY_LEGACY_PATH ??
    process.env.SOURCE_REGISTRY_PATH ??
    resolve(projectRoot, 'data', 'sources.json');
  const sourceRegistryExamplePath =
    input.registryExamplePath ??
    input.sourceRegistryExamplePath ??
    process.env.SOURCE_REGISTRY_EXAMPLE_PATH ??
    resolve(projectRoot, 'config', 'sources.example.json');
  const registry =
    input.registry ??
    (
      await loadSourceRegistryFromMongo({
        dbName: input.dbName,
        sourceRegistryExamplePath,
        sourceRegistryLegacyPath: registryLegacyPath,
        uri: input.uri,
      })
    ).registry;

  return runDiscoveryEnrichmentOrchestrator(
    {
      exaApiKey: process.env.EXA_API_KEY,
      mongoDbName: input.dbName,
      mongoUri: input.uri,
      registry,
      xaiApiKey: process.env.XAI_API_KEY,
    },
    {
      executeXSearchPlan: dependencies.executeXSearchPlan,
      fetchExaContents:
        dependencies.fetchExaContents ??
        (process.env.EXA_API_KEY
          ? async (urls) =>
              fetchExaContents(urls, {
                apiKey: process.env.EXA_API_KEY as string,
              })
          : undefined),
      fetchText: dependencies.fetchText,
      searchExa:
        dependencies.searchExa ??
        (process.env.EXA_API_KEY
          ? async (plan) =>
              searchExa(plan.target, {
                additionalQueries: plan.additionalQueries,
                apiKey: process.env.EXA_API_KEY as string,
                category: plan.category,
                excludeDomains: plan.excludeDomains,
                includeDomains: plan.includeDomains,
                numResults: plan.numResults,
                searchType: plan.searchType,
                userLocation: plan.userLocation,
              })
          : undefined),
      persistDiscoveryArtifact:
        dependencies.persistDiscoveryArtifact ??
        (async (artifact) =>
          saveDiscoveryArtifactToMongo(artifact, {
            dbName: input.dbName,
            uri: input.uri,
          })),
      persistStoryClusters: dependencies.persistStoryClusters,
      persistStories: dependencies.persistStories,
      persistFeedSnapshot:
        dependencies.persistFeedSnapshot ??
        (async (snapshot) =>
          writeFeedSnapshot(snapshot, {
            dbName: input.dbName,
            uri: input.uri,
          })),
      persistIngestRun:
        dependencies.persistIngestRun ??
        (async (run) =>
          saveIngestRunToMongo(run, {
            dbName: input.dbName,
            uri: input.uri,
          })),
    },
  );
}
