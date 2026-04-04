import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  readSourceRegistryFromFile,
  type SourceDefinition,
  type SourceRegistry,
  upsertSourceDefinition,
  writeSourceRegistryToFile,
} from '@news-aggregator/core';

const DEFAULT_PROJECT_ROOT = resolve(process.cwd(), '../..');

export type SourceRegistryPathOptions = {
  examplePath?: string;
  projectRoot?: string;
  storagePath?: string;
};

export type PersistedSourceRegistryState = {
  examplePath: string;
  registry: SourceRegistry;
  storagePath: string;
  usingExampleFallback: boolean;
};

export type SourceDefinitionPatch = Partial<
  Pick<SourceDefinition, 'enabled' | 'executionMode' | 'notes'>
>;

export function resolveSourceRegistryPaths(
  options: SourceRegistryPathOptions = {},
) {
  const projectRoot = options.projectRoot ?? DEFAULT_PROJECT_ROOT;

  return {
    storagePath:
      options.storagePath ??
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
  const { examplePath, storagePath } = resolveSourceRegistryPaths(options);
  const usingExampleFallback = !existsSync(storagePath);
  const registry = readSourceRegistryFromFile(
    usingExampleFallback ? examplePath : storagePath,
  );

  return {
    examplePath,
    registry,
    storagePath,
    usingExampleFallback,
  };
}

export async function savePersistedSourceRegistry(
  registry: SourceRegistry,
  options: SourceRegistryPathOptions = {},
): Promise<PersistedSourceRegistryState> {
  const { examplePath, storagePath } = resolveSourceRegistryPaths(options);
  const validated = writeSourceRegistryToFile(storagePath, registry);

  return {
    examplePath,
    registry: validated,
    storagePath,
    usingExampleFallback: false,
  };
}

export async function updateStoredSourceDefinition({
  examplePath,
  id,
  patch,
  projectRoot,
  storagePath,
}: {
  examplePath?: string;
  id: string;
  patch: SourceDefinitionPatch;
  projectRoot?: string;
  storagePath?: string;
}) {
  const options = {
    examplePath,
    projectRoot,
    storagePath,
  };
  const current = await loadPersistedSourceRegistry(options);
  const existing = current.registry.sources.find((source) => source.id === id);

  if (!existing) {
    throw new Error(`Source "${id}" was not found.`);
  }

  const nextRegistry = upsertSourceDefinition(current.registry, {
    ...existing,
    ...patch,
  });

  return savePersistedSourceRegistry(nextRegistry, options);
}
