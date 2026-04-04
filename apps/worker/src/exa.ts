import {
  loadCachedArticlesFromMongo,
  type MongoConnectionOptions,
  saveCachedArticlesToMongo,
} from '@news-aggregator/core';

export type ExaSearchResult = {
  highlights?: string[];
  id?: string;
  publishedDate?: string;
  summary?: string;
  text?: string;
  title?: string;
  url?: string;
};

export type ExaSearchResponse = {
  requestId?: string;
  results?: ExaSearchResult[];
};

export type ExaContentsResult = {
  id?: string;
  publishedDate?: string;
  summary?: string;
  text?: string;
  title?: string;
  url?: string;
};

export type ExaContentsResponse = {
  requestId?: string;
  results?: ExaContentsResult[];
  statuses?: Array<{
    id?: string;
    status?: string;
  }>;
};

const exaContentsBatchSize = 20;
const exaDetailedArticleMaxCharacters = 24000;

export type ExaSearchOptions = {
  additionalQueries?: string[];
  apiKey: string;
  category?: string;
  excludeDomains?: string[];
  fetchImplementation?: typeof fetch;
  includeDomains?: string[];
  now?: Date;
  numResults?: number;
  searchType?: string;
  sleepImplementation?: (ms: number) => Promise<void>;
  userLocation?: string;
};

export type ExaArticleCacheOptions = MongoConnectionOptions & {
  ttlDays?: number;
};

const exaBodyTextSections = ['body', 'metadata'] as const;
const exaExcludedTextSections = [
  'navigation',
  'banner',
  'sidebar',
  'footer',
] as const;

function getDefaultHeaders(apiKey: string) {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
  };
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get('retry-after');

  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }

  return 1000 * 2 ** attempt;
}

async function defaultSleep(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchExaWithRetry(
  url: string,
  init: RequestInit,
  options: {
    fetchImplementation: typeof fetch;
    sleepImplementation?: (ms: number) => Promise<void>;
  },
) {
  const sleepImplementation = options.sleepImplementation ?? defaultSleep;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await options.fetchImplementation(url, init);

    if (response.ok) {
      return response;
    }

    if (attempt < 3 && [429, 500, 502, 503, 504].includes(response.status)) {
      await sleepImplementation(getRetryDelayMs(response, attempt));
      continue;
    }

    return response;
  }

  throw new Error('Unreachable retry state for Exa request.');
}

async function throwExaError(response: Response, label: 'search' | 'contents') {
  const detail = (await response.text()).trim();
  const suffix = detail ? ` ${detail}` : '';

  throw new Error(
    `Exa ${label} failed with status ${response.status}.${suffix}`,
  );
}

export async function searchExa(query: string, options: ExaSearchOptions) {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const endPublishedDate = options.now ?? new Date();
  const startPublishedDate = new Date(
    endPublishedDate.getTime() - 24 * 60 * 60 * 1000,
  );
  const response = await fetchExaWithRetry(
    'https://api.exa.ai/search',
    {
      method: 'POST',
      headers: getDefaultHeaders(options.apiKey),
      body: JSON.stringify({
        contents: {
          filterEmptyResults: true,
          highlights: {
            maxCharacters: 2000,
            query,
          },
          livecrawlTimeout: 12000,
          maxAgeHours: 24,
          summary: {
            maxTokens: 220,
            query,
          },
          text: {
            excludeSections: [...exaExcludedTextSections],
            includeSections: [...exaBodyTextSections],
            maxCharacters: 12000,
            verbosity: 'standard',
          },
        },
        additionalQueries:
          options.additionalQueries && options.additionalQueries.length > 0
            ? options.additionalQueries
            : undefined,
        category: options.category,
        endPublishedDate: endPublishedDate.toISOString(),
        excludeDomains:
          options.excludeDomains && options.excludeDomains.length > 0
            ? options.excludeDomains
            : undefined,
        includeDomains:
          options.includeDomains && options.includeDomains.length > 0
            ? options.includeDomains
            : undefined,
        numResults: options.numResults ?? 10,
        query,
        startPublishedDate: startPublishedDate.toISOString(),
        type: options.searchType ?? 'auto',
        userLocation: options.userLocation,
      }),
    },
    {
      fetchImplementation,
      sleepImplementation: options.sleepImplementation,
    },
  );

  if (!response.ok) {
    await throwExaError(response, 'search');
  }

  return (await response.json()) as ExaSearchResponse;
}

export async function fetchExaContents(
  urls: string[],
  options: {
    apiKey: string;
    cache?: ExaArticleCacheOptions;
    fetchImplementation?: typeof fetch;
    sleepImplementation?: (ms: number) => Promise<void>;
  },
) {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const uniqueUrls = Array.from(new Set(urls));
  const cacheOptions = options.cache;
  const shouldUseCache = Boolean(
    cacheOptions?.client ?? cacheOptions?.uri ?? process.env.MONGODB_URI,
  );
  const cacheState = shouldUseCache
    ? await loadCachedArticlesFromMongo(uniqueUrls, {
        client: cacheOptions?.client,
        dbName: cacheOptions?.dbName,
        uri: cacheOptions?.uri,
      })
    : {
        hits: [],
        misses: uniqueUrls,
        storageTarget: '',
      };
  const urlsToFetch = shouldUseCache ? cacheState.misses : uniqueUrls;
  const batches = [];

  for (
    let index = 0;
    index < urlsToFetch.length;
    index += exaContentsBatchSize
  ) {
    batches.push(urlsToFetch.slice(index, index + exaContentsBatchSize));
  }

  const merged: ExaContentsResponse = {
    requestId: undefined,
    results: [...cacheState.hits],
    statuses: cacheState.hits.map((result) => ({
      id: result.url,
      status: 'cached',
    })),
  };

  for (const batch of batches) {
    const response = await fetchExaWithRetry(
      'https://api.exa.ai/contents',
      {
        method: 'POST',
        headers: getDefaultHeaders(options.apiKey),
        body: JSON.stringify({
          filterEmptyResults: true,
          ids: batch,
          livecrawl: 'always',
          livecrawlTimeout: 12000,
          summary: {
            maxTokens: 220,
          },
          text: {
            excludeSections: [...exaExcludedTextSections],
            includeSections: [...exaBodyTextSections],
            maxCharacters: exaDetailedArticleMaxCharacters,
            verbosity: 'standard',
          },
        }),
      },
      {
        fetchImplementation,
        sleepImplementation: options.sleepImplementation,
      },
    );

    if (!response.ok) {
      await throwExaError(response, 'contents');
    }

    const payload = (await response.json()) as ExaContentsResponse;

    merged.requestId ??= payload.requestId;
    merged.results?.push(...(payload.results ?? []));
    merged.statuses?.push(...(payload.statuses ?? []));

    if (shouldUseCache && (payload.results?.length ?? 0) > 0) {
      await saveCachedArticlesToMongo(payload.results ?? [], {
        client: cacheOptions?.client,
        dbName: cacheOptions?.dbName,
        ttlDays: cacheOptions?.ttlDays,
        uri: cacheOptions?.uri,
      });
    }
  }

  return merged;
}
