import {
  normalizeStoryCandidate,
  type SourceDefinition,
} from '@news-aggregator/core';
import type { ExecutedPublicSourceFetch } from './public-sources';
import { getXSearchOutputText, type XSearchResponsePayload } from './x-search';

function parseJsonText(input: string) {
  const trimmed = input.trim();
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```json\s*/u, '').replace(/\s*```$/u, '')
    : trimmed;

  return JSON.parse(withoutFence);
}

function summarizeText(input: string | undefined) {
  const normalized = input?.trim() ?? '';

  if (normalized.length <= 280) {
    return normalized;
  }

  return `${normalized.slice(0, 277).trimEnd()}...`;
}

export function normalizeExaSearchArtifact({
  artifact,
  source,
}: {
  artifact: ExecutedPublicSourceFetch;
  source: SourceDefinition;
}) {
  const payload = parseJsonText(artifact.content) as {
    results?: Array<{
      highlights?: string[];
      publishedDate?: string;
      summary?: string;
      text?: string;
      title?: string;
      url?: string;
    }>;
  };
  type ExaSearchResult = NonNullable<typeof payload.results>[number];
  const hasRequiredExaFields = (
    result: ExaSearchResult,
  ): result is ExaSearchResult & { title: string; url: string } =>
    typeof result.title === 'string' && typeof result.url === 'string';

  return (payload.results ?? []).filter(hasRequiredExaFields).map((result) =>
    normalizeStoryCandidate({
      canonicalUrl: result.url,
      importanceScore: source.trustWeight,
      personalScore: source.baseWeight,
      publishedAt: result.publishedDate ?? artifact.fetchedAt,
      regions: source.regions,
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      summary:
        summarizeText(
          result.summary ?? result.highlights?.join(' ') ?? result.text,
        ) || result.title,
      title: result.title,
      topics: source.topics,
    }),
  );
}

export function normalizeXSearchExecutionResult({
  result,
  source,
}: {
  result: {
    content: XSearchResponsePayload;
    sourceId: string;
  };
  source: SourceDefinition;
}) {
  const payload = parseJsonText(getXSearchOutputText(result.content)) as {
    stories?: Array<{
      publishedAt?: string;
      regions?: string[];
      summary?: string;
      title?: string;
      topics?: string[];
      url?: string;
    }>;
  };
  type XSearchStory = NonNullable<typeof payload.stories>[number];
  const hasRequiredXFields = (
    story: XSearchStory,
  ): story is XSearchStory & {
    publishedAt: string;
    title: string;
    url: string;
  } =>
    typeof story.title === 'string' &&
    typeof story.url === 'string' &&
    typeof story.publishedAt === 'string';

  return (payload.stories ?? []).filter(hasRequiredXFields).map((story) =>
    normalizeStoryCandidate({
      canonicalUrl: story.url,
      importanceScore: source.trustWeight,
      personalScore: source.baseWeight,
      publishedAt: story.publishedAt,
      regions: story.regions?.length ? story.regions : source.regions,
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      summary: summarizeText(story.summary) || story.title,
      title: story.title,
      topics: story.topics?.length ? story.topics : source.topics,
    }),
  );
}
