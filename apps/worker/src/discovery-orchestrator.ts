import { createHash } from 'node:crypto';
import {
  clusterStories,
  getArticleBodyStrategy,
  materializeFeedSnapshot,
  normalizeCanonicalUrl,
  normalizeStoryCandidate,
  type SourceDefinition,
  type SourceRegistry,
  type Story,
  type StoryCluster,
  saveDiscoveryArtifactToMongo,
  saveIngestRunToMongo,
  saveStoriesToMongo,
  saveStoryClustersToMongo,
  writeActivityLog,
} from '@news-aggregator/core';
import { load } from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import {
  type ExaContentsResponse,
  type ExaContentsResult,
  fetchExaContents,
  searchExa,
} from './exa';
import { writeFeedSnapshot } from './feed-materializer';
import {
  buildPublicSourceFetchPlans,
  type ExaSearchPlan,
  type ExecutedPublicSourceFetch,
  executePublicSourceFetchPlan,
} from './public-sources';
import { summarizeArticleBatch } from './summarize';
import {
  buildXSearchPlans,
  executeXSearchPlan,
  getXSearchOutputText,
  type XSearchResponsePayload,
} from './x-search';

export type DiscoveryCandidate = {
  candidateId: string;
  discoveryKind: 'exa-result' | 'homepage-link' | 'rss-item' | 'x-result';
  discoveredAt: string;
  publishedAt: string;
  regions: string[];
  sourceId: string;
  sourceName: string;
  sourceType: SourceDefinition['type'];
  summary: string;
  title: string;
  topics: string[];
  url: string;
};

export type IngestionSummary = {
  clusterCount: number;
  discoveryCount: number;
  enrichedStoryCount: number;
  feedSnapshot: ReturnType<typeof materializeFeedSnapshot>;
  generatedAt: string;
  rawArtifactIds: string[];
  runId: string;
  storyCount: number;
};

type DiscoveryArtifactInput = Array<{
  artifact: ExecutedPublicSourceFetch;
  source: SourceDefinition;
}>;

type XSearchInput = Array<{
  result: {
    content: XSearchResponsePayload;
    sourceId: string;
  };
  source: SourceDefinition;
}>;

type EnrichedCandidate = {
  bodyText?: string;
  canonicalUrl: string;
  publishedAt: string;
  regions: string[];
  source: SourceDefinition;
  summary: string;
  title: string;
  topics: string[];
};

export type DiscoveryOrchestratorDependencies = {
  executeXSearchPlan?: typeof executeXSearchPlan;
  fetchExaContents?: (urls: string[]) => Promise<ExaContentsResponse>;
  fetchText?: (url: string) => Promise<string>;
  persistFeedSnapshot?: (
    snapshot: ReturnType<typeof materializeFeedSnapshot>,
  ) => Promise<unknown>;
  persistStoryClusters?: (
    clusters: StoryCluster[],
    options: {
      generatedAt: string;
    },
  ) => Promise<{ storedCount: number }>;
  persistStories?: (
    stories: Story[],
    options: {
      generatedAt: string;
    },
  ) => Promise<{ storedCount: number }>;
  persistDiscoveryArtifact?: (input: {
    artifactKey: string;
    content: string;
    extension: 'html' | 'json' | 'txt' | 'xml';
    fetchedAt: string;
    sourceId: string;
    target: string;
  }) => Promise<{ artifactId: string }>;
  persistIngestRun?: (input: {
    candidates: DiscoveryCandidate[];
    clusterIds: string[];
    enrichedStories: EnrichedCandidate[];
    feedSnapshot: ReturnType<typeof materializeFeedSnapshot>;
    generatedAt: string;
    rawArtifactIds: string[];
    storyIds: string[];
  }) => Promise<{ runId: string }>;
  searchExa?: (plan: ExaSearchPlan) => Promise<unknown>;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  processEntities: true,
  trimValues: true,
});
const genericSectionSegments = new Set([
  'archive',
  'archives',
  'bc',
  'british-columbia',
  'business',
  'canada',
  'categories',
  'category',
  'global',
  'headlines',
  'local',
  'latest',
  'news',
  'section',
  'sections',
  'tag',
  'tags',
  'technology',
  'tech',
  'top-stories',
  'topic',
  'topics',
  'vancouver',
  'world',
]);

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function toArray<T>(value: T | T[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function parseJsonText<T>(input: string) {
  const trimmed = input.trim();
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```json\s*/u, '').replace(/\s*```$/u, '')
    : trimmed;

  return JSON.parse(withoutFence) as T;
}

function toIsoDate(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return fallback;
  }

  return timestamp.toISOString();
}

function summarizeText(input: string | undefined, fallback: string) {
  const normalized = input?.replace(/\s+/gu, ' ').trim() ?? '';

  if (!normalized) {
    return fallback;
  }

  if (normalized.length <= 280) {
    return normalized;
  }

  return `${normalized.slice(0, 277).trimEnd()}...`;
}

function isLikelyArticleUrl(input: {
  summary?: string;
  title: string;
  url: string;
}) {
  const url = new URL(input.url);
  const segments = url.pathname
    .split('/')
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
  const title = input.title.trim().toLowerCase();
  const summary = input.summary?.trim().toLowerCase() ?? '';

  if (segments.length === 0) {
    return false;
  }

  if (segments.includes('article') && segments.length >= 2) {
    return true;
  }

  if (segments.some((segment) => /\d{4}/u.test(segment))) {
    return true;
  }

  if (
    segments.some(
      (segment) =>
        segment.split('-').filter(Boolean).length >= 4 ||
        /\d{5,}/u.test(segment),
    )
  ) {
    return true;
  }

  if (segments.every((segment) => genericSectionSegments.has(segment))) {
    return false;
  }

  if (
    segments.some((segment) =>
      ['archive', 'archives', 'categories', 'category', 'tag', 'tags'].includes(
        segment,
      ),
    ) &&
    segments.length <= 3
  ) {
    return false;
  }

  if (
    segments.length === 1 &&
    segments[0] &&
    segments[0].includes('-') &&
    !genericSectionSegments.has(segments[0])
  ) {
    return true;
  }

  if (
    /ai category archive|category archive|latest headlines|local news|top local stories|weather|traffic updates|cbc news|breaking news/u.test(
      title,
    )
  ) {
    return false;
  }

  if (/top stories|breaking news/u.test(summary)) {
    return false;
  }

  return segments.length >= 2;
}

function stripHtmlToText(input: string) {
  const $ = load(input);

  return $('body').text().replace(/\s+/gu, ' ').trim();
}

function buildCandidateId(sourceId: string, url: string, title: string) {
  return `candidate_${hashValue(`${sourceId}:${url}:${title}`)}`;
}

function extractRssCandidates(input: {
  artifact: ExecutedPublicSourceFetch;
  source: SourceDefinition;
}): DiscoveryCandidate[] {
  const payload = xmlParser.parse(input.artifact.content) as {
    feed?: {
      entry?: Array<{
        link?: Array<{ '@_href'?: string }> | { '@_href'?: string };
        summary?: string;
        title?: string;
        updated?: string;
      }>;
    };
    rss?: {
      channel?: {
        item?:
          | Array<{
              description?: string;
              link?: string;
              pubDate?: string;
              title?: string;
            }>
          | {
              description?: string;
              link?: string;
              pubDate?: string;
              title?: string;
            };
      };
    };
  };

  const rssItems = toArray(payload.rss?.channel?.item).flatMap((item) => {
    if (typeof item.link !== 'string' || typeof item.title !== 'string') {
      return [];
    }

    return [
      {
        candidateId: buildCandidateId(input.source.id, item.link, item.title),
        discoveryKind: 'rss-item' as const,
        discoveredAt: input.artifact.fetchedAt,
        publishedAt: toIsoDate(item.pubDate, input.artifact.fetchedAt),
        regions: input.source.regions,
        sourceId: input.source.id,
        sourceName: input.source.name,
        sourceType: input.source.type,
        summary: summarizeText(item.description, item.title),
        title: item.title.trim(),
        topics: input.source.topics,
        url: item.link.trim(),
      },
    ];
  });

  const atomEntries = toArray(payload.feed?.entry).flatMap((entry) => {
    const link = toArray(entry.link)[0]?.['@_href'];

    if (typeof link !== 'string' || typeof entry.title !== 'string') {
      return [];
    }

    return [
      {
        candidateId: buildCandidateId(input.source.id, link, entry.title),
        discoveryKind: 'rss-item' as const,
        discoveredAt: input.artifact.fetchedAt,
        publishedAt: toIsoDate(entry.updated, input.artifact.fetchedAt),
        regions: input.source.regions,
        sourceId: input.source.id,
        sourceName: input.source.name,
        sourceType: input.source.type,
        summary: summarizeText(entry.summary, entry.title),
        title: entry.title.trim(),
        topics: input.source.topics,
        url: link.trim(),
      },
    ];
  });

  return [...rssItems, ...atomEntries];
}

function extractHomepageCandidates(input: {
  artifact: ExecutedPublicSourceFetch;
  source: SourceDefinition;
}): DiscoveryCandidate[] {
  const $ = load(input.artifact.content);
  const baseUrl = new URL(input.artifact.target);
  const titlelineAnchors = $('span.titleline a').toArray();
  const anchorSelection =
    titlelineAnchors.length > 0 ? titlelineAnchors : $('a[href]').toArray();
  const dedupe = new Set<string>();

  return anchorSelection
    .flatMap((anchor) => {
      const element = $(anchor);
      const href = element.attr('href');
      const title = element.text().replace(/\s+/gu, ' ').trim();

      if (!href || title.length < 8) {
        return [];
      }

      if (
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:')
      ) {
        return [];
      }

      const resolvedUrl = new URL(href, baseUrl).toString();
      const resolvedHost = new URL(resolvedUrl).hostname;

      if (resolvedHost === 'news.ycombinator.com' || dedupe.has(resolvedUrl)) {
        return [];
      }

      dedupe.add(resolvedUrl);

      return [
        {
          candidateId: buildCandidateId(input.source.id, resolvedUrl, title),
          discoveryKind: 'homepage-link' as const,
          discoveredAt: input.artifact.fetchedAt,
          publishedAt: input.artifact.fetchedAt,
          regions: input.source.regions,
          sourceId: input.source.id,
          sourceName: input.source.name,
          sourceType: input.source.type,
          summary: summarizeText(
            `${title} was surfaced from ${input.source.name}.`,
            title,
          ),
          title,
          topics: input.source.topics,
          url: resolvedUrl,
        },
      ];
    })
    .slice(0, 30);
}

function extractExaCandidates(input: {
  artifact: ExecutedPublicSourceFetch;
  source: SourceDefinition;
}): DiscoveryCandidate[] {
  const payload = parseJsonText<{
    results?: Array<{
      publishedDate?: string;
      summary?: string;
      text?: string;
      title?: string;
      url?: string;
    }>;
  }>(input.artifact.content);

  return (payload.results ?? []).flatMap((result) => {
    if (typeof result.title !== 'string' || typeof result.url !== 'string') {
      return [];
    }

    if (
      !isLikelyArticleUrl({
        summary: result.summary ?? result.text,
        title: result.title,
        url: result.url,
      })
    ) {
      return [];
    }

    return [
      {
        candidateId: buildCandidateId(
          input.source.id,
          result.url,
          result.title,
        ),
        discoveryKind: 'exa-result' as const,
        discoveredAt: input.artifact.fetchedAt,
        publishedAt: toIsoDate(result.publishedDate, input.artifact.fetchedAt),
        regions: input.source.regions,
        sourceId: input.source.id,
        sourceName: input.source.name,
        sourceType: input.source.type,
        summary: summarizeText(result.summary ?? result.text, result.title),
        title: result.title.trim(),
        topics: input.source.topics,
        url: result.url.trim(),
      },
    ];
  });
}

function extractXCandidates(input: XSearchInput[number]): DiscoveryCandidate[] {
  const payload = parseJsonText<{
    stories?: Array<{
      publishedAt?: string;
      regions?: string[];
      summary?: string;
      title?: string;
      topics?: string[];
      url?: string;
    }>;
  }>(getXSearchOutputText(input.result.content));

  return (payload.stories ?? []).flatMap((story) => {
    if (typeof story.title !== 'string' || typeof story.url !== 'string') {
      return [];
    }

    return [
      {
        candidateId: buildCandidateId(input.source.id, story.url, story.title),
        discoveryKind: 'x-result' as const,
        discoveredAt: new Date().toISOString(),
        publishedAt: toIsoDate(story.publishedAt, new Date().toISOString()),
        regions:
          story.regions && story.regions.length > 0
            ? story.regions
            : input.source.regions,
        sourceId: input.source.id,
        sourceName: input.source.name,
        sourceType: input.source.type,
        summary: summarizeText(story.summary, story.title),
        title: story.title.trim(),
        topics:
          story.topics && story.topics.length > 0
            ? story.topics
            : input.source.topics,
        url: story.url.trim(),
      },
    ];
  });
}

export function extractDiscoveryCandidates(input: {
  publicArtifacts: DiscoveryArtifactInput;
  xSearchResults: XSearchInput;
}): DiscoveryCandidate[] {
  return [
    ...input.publicArtifacts.flatMap(({ artifact, source }) => {
      if (artifact.artifactKey === 'discovery-rss') {
        return extractRssCandidates({ artifact, source });
      }

      if (artifact.artifactKey === 'discovery-http') {
        return extractHomepageCandidates({ artifact, source });
      }

      if (artifact.artifactKey === 'discovery-exa-search') {
        return extractExaCandidates({ artifact, source });
      }

      return [];
    }),
    ...input.xSearchResults.flatMap((entry) => extractXCandidates(entry)),
  ];
}

function getExtensionForArtifact(
  artifact: ExecutedPublicSourceFetch,
): 'html' | 'json' | 'txt' | 'xml' {
  if (artifact.artifactKey === 'discovery-http') {
    return 'html';
  }

  if (artifact.artifactKey === 'discovery-rss') {
    return 'xml';
  }

  return 'json';
}

function groupExaResultsByUrl(payload: ExaContentsResponse) {
  const entries: Array<[string, ExaContentsResult]> = [];

  for (const result of payload.results ?? []) {
    if (typeof result.url !== 'string') {
      continue;
    }

    entries.push([result.url, result]);

    try {
      const normalizedUrl = normalizeCanonicalUrl(result.url);

      if (normalizedUrl !== result.url) {
        entries.push([normalizedUrl, result]);
      }
    } catch {
      // Ignore invalid URLs and keep the original result URL only.
    }
  }

  return new Map(entries);
}

function getExaResultForUrl(
  resultsByUrl: Map<string, ExaContentsResult>,
  url: string,
) {
  const directMatch = resultsByUrl.get(url);

  if (directMatch) {
    return directMatch;
  }

  try {
    return resultsByUrl.get(normalizeCanonicalUrl(url));
  } catch {
    return undefined;
  }
}

function assignClusterIdsToStories(clusters: StoryCluster[]) {
  return clusters.map((cluster) => ({
    ...cluster,
    stories: cluster.stories.map((story) => ({
      ...story,
      clusterId: cluster.clusterId,
    })),
  }));
}

async function enrichDiscoveryCandidates(
  candidates: DiscoveryCandidate[],
  input: {
    exaApiKey?: string;
    fetchExaContents?: (urls: string[]) => Promise<ExaContentsResponse>;
    fetchText?: (url: string) => Promise<string>;
    generatedAt: string;
    mongoDbName?: string;
    mongoUri?: string;
    sourceIndex: Map<string, SourceDefinition>;
  },
): Promise<EnrichedCandidate[]> {
  const uniqueExaUrls = Array.from(
    new Set(
      candidates.flatMap((candidate) => {
        const source = input.sourceIndex.get(candidate.sourceId);

        if (!source) {
          return [];
        }

        const strategy = getArticleBodyStrategy({
          prefersBrowser: source.fetchMethod === 'browser-scrape',
          requiresAuthentication: source.requiresAuthentication,
          url: candidate.url,
        });

        return strategy.primary === 'exa-contents' ? [candidate.url] : [];
      }),
    ),
  );
  const exaContents =
    uniqueExaUrls.length > 0
      ? await (input.fetchExaContents
          ? input.fetchExaContents(uniqueExaUrls)
          : input.exaApiKey
            ? fetchExaContents(uniqueExaUrls, {
                apiKey: input.exaApiKey,
                cache: {
                  dbName: input.mongoDbName,
                  uri: input.mongoUri,
                },
              })
            : Promise.resolve({ results: [], statuses: [] }))
      : { results: [], statuses: [] };
  const exaResultByUrl = groupExaResultsByUrl(exaContents);

  return Promise.all(
    candidates.flatMap(async (candidate) => {
      const source = input.sourceIndex.get(candidate.sourceId);

      if (!source) {
        return [];
      }

      const exaResult = getExaResultForUrl(exaResultByUrl, candidate.url);

      if (exaResult) {
        return [
          {
            bodyText: exaResult.text?.trim() || undefined,
            canonicalUrl: exaResult.url ?? candidate.url,
            publishedAt: toIsoDate(
              exaResult.publishedDate,
              candidate.publishedAt || input.generatedAt,
            ),
            regions: candidate.regions,
            source,
            summary: summarizeText(
              exaResult.text ?? exaResult.summary,
              candidate.summary,
            ),
            title: exaResult.title?.trim() || candidate.title,
            topics: candidate.topics,
          },
        ];
      }

      const strategy = getArticleBodyStrategy({
        prefersBrowser: source.fetchMethod === 'browser-scrape',
        requiresAuthentication: source.requiresAuthentication,
        url: candidate.url,
      });

      if (strategy.fallbacks.includes('direct-http') && input.fetchText) {
        const fetchedText = await input.fetchText(candidate.url);
        const bodyText = stripHtmlToText(fetchedText) || fetchedText.trim();

        return [
          {
            bodyText,
            canonicalUrl: candidate.url,
            publishedAt: candidate.publishedAt,
            regions: candidate.regions,
            source,
            summary: summarizeText(bodyText, candidate.summary),
            title: candidate.title,
            topics: candidate.topics,
          },
        ];
      }

      return [
        {
          bodyText: undefined,
          canonicalUrl: candidate.url,
          publishedAt: candidate.publishedAt,
          regions: candidate.regions,
          source,
          summary: candidate.summary,
          title: candidate.title,
          topics: candidate.topics,
        },
      ];
    }),
  ).then((groups) => groups.flat());
}

export async function runDiscoveryEnrichmentOrchestrator(
  input: {
    exaApiKey?: string;
    mongoDbName?: string;
    mongoUri?: string;
    now?: () => Date;
    registry: SourceRegistry;
    xaiApiKey?: string;
  },
  dependencies: DiscoveryOrchestratorDependencies = {},
) {
  const now = input.now ?? (() => new Date());
  const generatedAt = now().toISOString();
  const sourceIndex = new Map(
    input.registry.sources.map((source) => [source.id, source]),
  );
  const searchExaDependency = dependencies.searchExa;
  const rawArtifactIds: string[] = [];
  const publicPlans = buildPublicSourceFetchPlans(input.registry);
  const publicArtifacts = await Promise.all(
    publicPlans.map(async (plan) => {
      const planSource = sourceIndex.get(plan.sourceId);
      writeActivityLog({
        severity: 'info',
        source: 'ingest',
        message: `Fetching source: ${planSource?.name ?? plan.sourceId}`,
        metadata: {
          sourceId: plan.sourceId,
          fetchMethod: planSource?.fetchMethod,
          target: plan.target,
        },
      }).catch(() => {});
      const artifact = await executePublicSourceFetchPlan(plan, {
        fetchText: dependencies.fetchText,
        now,
        searchExa: searchExaDependency
          ? async (plan) => searchExaDependency(plan)
          : input.exaApiKey
            ? async (plan) =>
                searchExa(plan.target, {
                  additionalQueries: plan.additionalQueries,
                  apiKey: input.exaApiKey as string,
                  category: plan.category,
                  excludeDomains: plan.excludeDomains,
                  includeDomains: plan.includeDomains,
                  numResults: plan.numResults,
                  searchType: plan.searchType,
                  userLocation: plan.userLocation,
                })
            : undefined,
      });
      const persistedArtifact = await (dependencies.persistDiscoveryArtifact
        ? dependencies.persistDiscoveryArtifact({
            artifactKey: artifact.artifactKey,
            content: artifact.content,
            extension: getExtensionForArtifact(artifact),
            fetchedAt: artifact.fetchedAt,
            sourceId: artifact.sourceId,
            target: artifact.target,
          })
        : saveDiscoveryArtifactToMongo({
            artifactKey: artifact.artifactKey,
            content: artifact.content,
            extension: getExtensionForArtifact(artifact),
            fetchedAt: artifact.fetchedAt,
            sourceId: artifact.sourceId,
            target: artifact.target,
          }));
      rawArtifactIds.push(persistedArtifact.artifactId);

      const source = sourceIndex.get(plan.sourceId);

      if (!source) {
        throw new Error(`Unknown source for public plan "${plan.sourceId}".`);
      }

      return {
        artifact,
        source,
      };
    }),
  );
  const xPlans = buildXSearchPlans(input.registry);
  const xSearchResults = await Promise.all(
    xPlans.map(async (plan) => {
      const xSource = sourceIndex.get(plan.sourceId);
      writeActivityLog({
        severity: 'info',
        source: 'ingest',
        message: `X search: ${xSource?.name ?? plan.sourceId}`,
        metadata: { sourceId: plan.sourceId, query: plan.query },
      }).catch(() => {});
      const executePlan = dependencies.executeXSearchPlan ?? executeXSearchPlan;

      if (!dependencies.executeXSearchPlan && !input.xaiApiKey) {
        throw new Error(
          'XAI_API_KEY is required to run active x-search sources.',
        );
      }

      const result = await executePlan(plan, {
        apiKey: input.xaiApiKey as string,
      });
      const source = sourceIndex.get(plan.sourceId);

      if (!source) {
        throw new Error(`Unknown source for x-search plan "${plan.sourceId}".`);
      }

      return {
        result,
        source,
      };
    }),
  );
  const candidates = extractDiscoveryCandidates({
    publicArtifacts,
    xSearchResults,
  });
  const enriched = await enrichDiscoveryCandidates(candidates, {
    exaApiKey: input.exaApiKey,
    fetchExaContents: dependencies.fetchExaContents,
    fetchText: dependencies.fetchText,
    generatedAt,
    mongoDbName: input.mongoDbName,
    mongoUri: input.mongoUri,
    sourceIndex,
  });
  const stories = enriched.map((story) =>
    normalizeStoryCandidate({
      bodyText: story.bodyText,
      canonicalUrl: story.canonicalUrl,
      importanceScore: story.source.trustWeight,
      personalScore: story.source.baseWeight,
      publishedAt: story.publishedAt,
      regions: story.regions,
      sourceId: story.source.id,
      sourceName: story.source.name,
      sourceType: story.source.type,
      summary: story.summary,
      title: story.title,
      topics: story.topics,
    }),
  );

  // LLM summarization — replace extractive summaries with editorial ones
  if (process.env.XAI_API_KEY) {
    const storiesWithBody = stories.filter((s) => s.bodyText);
    if (storiesWithBody.length > 0) {
      const summaryResults = await summarizeArticleBatch(
        storiesWithBody.map((s) => ({
          title: s.title,
          sourceName: s.sourceName,
          bodyText: s.bodyText,
          rawSummary: s.summary,
          topics: s.topics,
          regions: s.regions,
        })),
      );

      for (let i = 0; i < storiesWithBody.length; i++) {
        const result = summaryResults[i];
        storiesWithBody[i].summary = result.summary;
        if (result.topics.length > 0) storiesWithBody[i].topics = result.topics;
        if (result.regions.length > 0)
          storiesWithBody[i].regions = result.regions;
      }
    }
  }

  const clusters = assignClusterIdsToStories(clusterStories(stories));
  const storiesWithClusterIds = clusters.flatMap((cluster) => cluster.stories);

  await (dependencies.persistStories
    ? dependencies.persistStories(storiesWithClusterIds, {
        generatedAt,
      })
    : saveStoriesToMongo(storiesWithClusterIds, {
        dbName: input.mongoDbName,
        generatedAt,
        uri: input.mongoUri,
      }));
  await (dependencies.persistStoryClusters
    ? dependencies.persistStoryClusters(clusters, {
        generatedAt,
      })
    : saveStoryClustersToMongo(clusters, {
        dbName: input.mongoDbName,
        generatedAt,
        uri: input.mongoUri,
      }));

  const feedSnapshot = materializeFeedSnapshot(clusters, {
    generatedAt,
  });
  await (dependencies.persistFeedSnapshot
    ? dependencies.persistFeedSnapshot(feedSnapshot)
    : writeFeedSnapshot(feedSnapshot));
  const persistedRun = await (dependencies.persistIngestRun
    ? dependencies.persistIngestRun({
        candidates,
        clusterIds: clusters.map((cluster) => cluster.clusterId),
        enrichedStories: enriched,
        feedSnapshot,
        generatedAt,
        rawArtifactIds,
        storyIds: storiesWithClusterIds.map((story) => story.storyId),
      })
    : saveIngestRunToMongo({
        candidates,
        clusterIds: clusters.map((cluster) => cluster.clusterId),
        enrichedStories: enriched,
        feedSnapshot,
        generatedAt,
        rawArtifactIds,
        storyIds: storiesWithClusterIds.map((story) => story.storyId),
      }));

  const summary: IngestionSummary = {
    clusterCount: clusters.length,
    discoveryCount: candidates.length,
    enrichedStoryCount: storiesWithClusterIds.length,
    feedSnapshot,
    generatedAt,
    rawArtifactIds,
    runId: persistedRun.runId,
    storyCount: storiesWithClusterIds.length,
  };

  writeActivityLog({
    severity: 'info',
    source: 'ingest',
    message: `Ingestion complete: ${summary.discoveryCount} discovered, ${summary.storyCount} stories, ${summary.clusterCount} clusters`,
    metadata: {
      runId: summary.runId,
      discoveryCount: summary.discoveryCount,
      storyCount: summary.storyCount,
      clusterCount: summary.clusterCount,
      feedEntryCount: feedSnapshot.entries.length,
      sourcesConsulted: publicPlans.length + xPlans.length,
    },
  }).catch(() => {});

  return summary;
}
