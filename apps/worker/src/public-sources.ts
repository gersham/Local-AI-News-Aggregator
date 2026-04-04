import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getRunnableSources, type SourceRegistry } from '@news-aggregator/core';

export type ExaSearchPlan = {
  additionalQueries: string[];
  artifactKey: 'discovery-exa-search';
  category: string;
  excludeDomains: string[];
  includeDomains: string[];
  kind: 'exa-search';
  numResults: number;
  searchType: string;
  sourceId: string;
  target: string;
  userLocation?: string;
};

export type PublicSourceFetchPlan =
  | {
      artifactKey: 'discovery-http' | 'discovery-rss';
      kind: 'http-text';
      sourceId: string;
      target: string;
    }
  | ExaSearchPlan;

export type ExecutedPublicSourceFetch = {
  artifactKey: PublicSourceFetchPlan['artifactKey'];
  content: string;
  fetchedAt: string;
  sourceId: string;
  target: string;
};

function deriveExaUserLocation(regions: string[]) {
  const regionalCountryMap: Record<string, string> = {
    bc: 'ca',
    canada: 'ca',
    china: 'cn',
    ireland: 'ie',
    japan: 'jp',
    lantzville: 'ca',
    thailand: 'th',
    uk: 'gb',
    usa: 'us',
    vancouver: 'ca',
  };

  for (const region of regions) {
    const normalized = region.trim().toLowerCase();
    const mapped = regionalCountryMap[normalized];

    if (mapped) {
      return mapped;
    }
  }

  return undefined;
}

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
            additionalQueries: source.additionalQueries,
            artifactKey: 'discovery-exa-search',
            category: source.exaCategory ?? 'news',
            excludeDomains: source.excludeDomains,
            includeDomains: source.includeDomains,
            kind: 'exa-search',
            numResults: source.exaNumResults ?? 25,
            searchType:
              source.exaSearchType ??
              (source.additionalQueries.length > 0 ? 'deep' : 'auto'),
            sourceId: source.id,
            target: source.query,
            userLocation:
              source.exaUserLocation ?? deriveExaUserLocation(source.regions),
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
    fetchImplementation?: typeof fetch;
    now?: () => Date;
    searchExa?: (plan: ExaSearchPlan) => Promise<unknown>;
  } = {},
): Promise<ExecutedPublicSourceFetch> {
  const now = dependencies.now ?? (() => new Date());

  if (plan.kind === 'http-text') {
    const fetchText =
      dependencies.fetchText ??
      (async (url: string) => {
        const fetchImplementation = dependencies.fetchImplementation ?? fetch;
        const response = await fetchImplementation(url);

        if (!response.ok) {
          throw new Error(
            `Public source fetch failed with status ${response.status}.`,
          );
        }

        return response.text();
      });

    return {
      artifactKey: plan.artifactKey,
      content: await fetchText(plan.target),
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
    content: JSON.stringify(await dependencies.searchExa(plan), null, 2),
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
