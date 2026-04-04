import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getRunnableSources, type SourceRegistry } from '@news-aggregator/core';

export type PublicSourceFetchPlan =
  | {
      artifactKey: 'discovery-http' | 'discovery-rss';
      kind: 'http-text';
      sourceId: string;
      target: string;
    }
  | {
      artifactKey: 'discovery-exa-search';
      kind: 'exa-search';
      sourceId: string;
      target: string;
    };

export type ExecutedPublicSourceFetch = {
  artifactKey: PublicSourceFetchPlan['artifactKey'];
  content: string;
  fetchedAt: string;
  sourceId: string;
  target: string;
};

export function buildPublicSourceFetchPlans(registry: SourceRegistry) {
  return getRunnableSources(registry).flatMap(
    (source): PublicSourceFetchPlan[] => {
      if (source.requiresAuthentication) {
        return [];
      }

      if (source.fetchMethod === 'rss' && source.rssUrl) {
        return [
          {
            artifactKey: 'discovery-rss',
            kind: 'http-text',
            sourceId: source.id,
            target: source.rssUrl,
          },
        ];
      }

      if (source.fetchMethod === 'http' && source.seedUrls[0]) {
        return [
          {
            artifactKey: 'discovery-http',
            kind: 'http-text',
            sourceId: source.id,
            target: source.seedUrls[0],
          },
        ];
      }

      if (source.fetchMethod === 'exa-search' && source.query) {
        return [
          {
            artifactKey: 'discovery-exa-search',
            kind: 'exa-search',
            sourceId: source.id,
            target: source.query,
          },
        ];
      }

      return [];
    },
  );
}

export async function executePublicSourceFetchPlan(
  plan: PublicSourceFetchPlan,
  dependencies: {
    fetchText?: (url: string) => Promise<string>;
    now?: () => Date;
    searchExa?: (query: string) => Promise<unknown>;
  } = {},
): Promise<ExecutedPublicSourceFetch> {
  const now = dependencies.now ?? (() => new Date());

  if (plan.kind === 'http-text') {
    if (!dependencies.fetchText) {
      throw new Error('fetchText dependency is required for http-text plans.');
    }

    return {
      artifactKey: plan.artifactKey,
      content: await dependencies.fetchText(plan.target),
      fetchedAt: now().toISOString(),
      sourceId: plan.sourceId,
      target: plan.target,
    };
  }

  if (!dependencies.searchExa) {
    throw new Error('searchExa dependency is required for exa-search plans.');
  }

  return {
    artifactKey: plan.artifactKey,
    content: JSON.stringify(await dependencies.searchExa(plan.target), null, 2),
    fetchedAt: now().toISOString(),
    sourceId: plan.sourceId,
    target: plan.target,
  };
}

export async function writePublicSourceArtifact({
  artifactRoot,
  content,
  extension,
  fetchedAt,
  sourceId,
  stage,
}: {
  artifactRoot: string;
  content: string;
  extension: 'html' | 'json' | 'txt' | 'xml';
  fetchedAt: string;
  sourceId: string;
  stage: ExecutedPublicSourceFetch['artifactKey'];
}) {
  const date = fetchedAt.slice(0, 10);
  const path = join(
    artifactRoot,
    'raw-discovery',
    date,
    sourceId,
    `${stage}.${extension}`,
  );

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');

  return path;
}
