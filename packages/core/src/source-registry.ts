import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SourceRegistry } from './config';
import { parseSourceRegistry } from './config';
import type { SourceDefinition } from './domain';

export type ArticleBodyStrategyInput = {
  requiresAuthentication: boolean;
  prefersBrowser: boolean;
  url: string;
};

export type ArticleBodyStrategy = {
  primary: 'exa-contents' | 'browser-scrape' | 'direct-http';
  fallbacks: Array<'direct-http' | 'browser-scrape'>;
};

export function readSourceRegistryFromFile(path: string) {
  const text = readFileSync(path, 'utf8');
  return parseSourceRegistry(JSON.parse(text));
}

export function writeSourceRegistryToFile(
  path: string,
  registry: SourceRegistry,
) {
  const validated = parseSourceRegistry(registry);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');

  return validated;
}

export function upsertSourceDefinition(
  registry: SourceRegistry,
  source: SourceDefinition,
) {
  const nextSources = registry.sources.some(
    (existing) => existing.id === source.id,
  )
    ? registry.sources.map((existing) =>
        existing.id === source.id ? source : existing,
      )
    : [...registry.sources, source];

  return parseSourceRegistry({
    sources: nextSources,
  });
}

export function getRunnableSources(registry: SourceRegistry) {
  return registry.sources.filter(
    (source) => source.enabled && source.executionMode === 'active',
  );
}

export function getArticleBodyStrategy(
  input: ArticleBodyStrategyInput,
): ArticleBodyStrategy {
  if (input.requiresAuthentication || input.prefersBrowser) {
    return {
      primary: 'browser-scrape',
      fallbacks: [],
    };
  }

  return {
    primary: 'exa-contents',
    fallbacks: ['direct-http', 'browser-scrape'],
  };
}
