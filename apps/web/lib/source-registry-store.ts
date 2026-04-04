import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  loadSourceRegistryFromMongo,
  type SourceDefinition,
  type SourceRegistry,
  saveSourceRegistryToMongo,
  updateSourceDefinitionInMongo,
  upsertSourceDefinition,
} from '@news-aggregator/core';

const DEFAULT_PROJECT_ROOT = resolve(process.cwd(), '../..');

export type SourceRegistryPathOptions = {
  dbName?: string;
  examplePath?: string;
  legacyPath?: string;
  projectRoot?: string;
  uri?: string;
};

export type PersistedSourceRegistryState = {
  examplePath: string;
  registry: SourceRegistry;
  storageTarget: string;
  usingExampleFallback: boolean;
};

export type SourceDefinitionPatch = Partial<
  Pick<
    SourceDefinition,
    | 'additionalQueries'
    | 'baseWeight'
    | 'enabled'
    | 'exaCategory'
    | 'exaNumResults'
    | 'exaSearchType'
    | 'exaUserLocation'
    | 'executionMode'
    | 'excludeDomains'
    | 'includeDomains'
    | 'notes'
    | 'query'
    | 'regions'
    | 'rssUrl'
    | 'seedUrls'
    | 'topics'
    | 'trustWeight'
  >
>;

export function resolveSourceRegistryPaths(
  options: SourceRegistryPathOptions = {},
) {
  const projectRoot = options.projectRoot ?? DEFAULT_PROJECT_ROOT;

  return {
    legacyPath:
      options.legacyPath ??
      process.env.SOURCE_REGISTRY_LEGACY_PATH ??
      process.env.SOURCE_REGISTRY_PATH ??
      join(projectRoot, 'data', 'sources.json'),
    examplePath:
      options.examplePath ??
      process.env.SOURCE_REGISTRY_EXAMPLE_PATH ??
      join(projectRoot, 'config', 'sources.example.json'),
  };
}

export async function loadPersistedSourceRegistry(
  options: SourceRegistryPathOptions = {},
): Promise<PersistedSourceRegistryState> {
  const { examplePath, legacyPath } = resolveSourceRegistryPaths(options);
  const state = await loadSourceRegistryFromMongo({
    dbName: options.dbName,
    sourceRegistryExamplePath: examplePath,
    sourceRegistryLegacyPath: existsSync(legacyPath) ? legacyPath : undefined,
    uri: options.uri,
  });

  return {
    examplePath,
    registry: state.registry,
    storageTarget: state.storageTarget,
    usingExampleFallback: state.usingExampleFallback,
  };
}

export async function savePersistedSourceRegistry(
  registry: SourceRegistry,
  options: SourceRegistryPathOptions = {},
): Promise<PersistedSourceRegistryState> {
  const { examplePath } = resolveSourceRegistryPaths(options);
  const saved = await saveSourceRegistryToMongo(registry, {
    dbName: options.dbName,
    uri: options.uri,
  });

  return {
    examplePath,
    registry: saved.registry,
    storageTarget: saved.storageTarget,
    usingExampleFallback: false,
  };
}

export async function updateStoredSourceDefinition({
  examplePath,
  id,
  legacyPath,
  patch,
  projectRoot,
  dbName,
  uri,
}: {
  dbName?: string;
  examplePath?: string;
  id: string;
  legacyPath?: string;
  patch: SourceDefinitionPatch;
  projectRoot?: string;
  uri?: string;
}) {
  const options = {
    dbName,
    examplePath,
    legacyPath,
    projectRoot,
    uri,
  };
  const { examplePath: resolvedExamplePath, legacyPath: resolvedLegacyPath } =
    resolveSourceRegistryPaths(options);
  const updated = await updateSourceDefinitionInMongo({
    dbName,
    id,
    patch,
    sourceRegistryExamplePath: resolvedExamplePath,
    sourceRegistryLegacyPath: existsSync(resolvedLegacyPath)
      ? resolvedLegacyPath
      : undefined,
    uri,
  });

  return {
    examplePath: resolvedExamplePath,
    registry: updated.registry,
    storageTarget: updated.storageTarget,
    usingExampleFallback: false,
  };
}

export async function addNewSourceDefinition(
  source: SourceDefinition,
  options: SourceRegistryPathOptions = {},
): Promise<PersistedSourceRegistryState> {
  const state = await loadPersistedSourceRegistry(options);
  const updated = upsertSourceDefinition(state.registry, source);
  return savePersistedSourceRegistry(updated, options);
}

export async function deleteSourceDefinition(
  id: string,
  options: SourceRegistryPathOptions = {},
): Promise<PersistedSourceRegistryState> {
  const state = await loadPersistedSourceRegistry(options);
  const filtered = {
    ...state.registry,
    sources: state.registry.sources.filter((s) => s.id !== id),
  };
  return savePersistedSourceRegistry(filtered, options);
}
