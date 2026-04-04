import { createHash } from 'node:crypto';
import { type Story, storyClusterSchema, storySchema } from './domain';

const trackingParams = new Set([
  'fbclid',
  'gclid',
  'ref',
  'src',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
]);

const stopWords = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'from',
  'in',
  'new',
  'of',
  'on',
  'the',
  'to',
  'with',
]);

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

const metaSummaryLeadPattern =
  /^(?:the\s+)?(?:webpage|article|report|story|piece|coverage)\s+(?:reports|says|notes|details|describes|explains|outlines|covers|mentions|states)\s+(?:that\s+)?/iu;
const metaSummarySentencePattern =
  /^(?:the\s+)?(?:webpage|article|report|story|piece|coverage)\s+(?:reports|says|notes|details|describes|explains|outlines|covers|mentions|states|highlights)\b/iu;

function stripMetaSummaryPrefix(input: string) {
  return input.replace(metaSummaryLeadPattern, '');
}

function isMetaSummarySentence(input: string) {
  return metaSummarySentencePattern.test(input.trim());
}

function capitalizeSummaryLead(input: string) {
  return input.replace(/^\p{Ll}/u, (character) => character.toUpperCase());
}

export function normalizeStorySummary(input: string) {
  const normalized = input.replace(/\s+/gu, ' ').trim();

  if (!normalized) {
    return '';
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return capitalizeSummaryLead(stripMetaSummaryPrefix(normalized).trim());
  }

  const cleanedSentences = sentences
    .map((sentence, index) =>
      index === 0 ? stripMetaSummaryPrefix(sentence).trim() : sentence,
    )
    .filter(
      (sentence) => sentence.length > 0 && !isMetaSummarySentence(sentence),
    );

  if (cleanedSentences.length === 0) {
    return capitalizeSummaryLead(stripMetaSummaryPrefix(normalized).trim());
  }

  return capitalizeSummaryLead(cleanedSentences.join(' ').trim());
}

export function normalizeCanonicalUrl(input: string) {
  const url = new URL(input);

  url.hash = '';

  for (const key of [...url.searchParams.keys()]) {
    if (trackingParams.has(key)) {
      url.searchParams.delete(key);
    }
  }

  const normalized = url.toString();

  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function normalizeTitleTokens(title: string) {
  return Array.from(
    new Set(
      title
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .map((token) =>
          token.replace(/(?:ing|ed|es|s)$/u, '').replace(/[^a-z0-9]/giu, ''),
        )
        .filter((token) => token.length > 1 && !stopWords.has(token)),
    ),
  );
}

function getTitleSimilarity(left: string, right: string) {
  const leftTokens = normalizeTitleTokens(left);
  const rightTokens = normalizeTitleTokens(right);
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  return intersection / (leftSet.size + rightSet.size - intersection);
}

function arePublishedWithinOneDay(left: string, right: string) {
  return (
    Math.abs(new Date(left).getTime() - new Date(right).getTime()) <=
    24 * 60 * 60 * 1000
  );
}

function areSameStory(left: Story, right: Story) {
  if (left.canonicalUrl === right.canonicalUrl) {
    return true;
  }

  return (
    arePublishedWithinOneDay(left.publishedAt, right.publishedAt) &&
    getTitleSimilarity(left.title, right.title) >= 0.6
  );
}

export function normalizeStoryCandidate(input: {
  bodyText?: string;
  canonicalUrl: string;
  citations?: Story['citations'];
  importanceScore?: number;
  personalScore?: number;
  publishedAt: string;
  regions: string[];
  sourceId: string;
  sourceName: string;
  sourceType: Story['sourceType'];
  summary: string;
  title: string;
  topics: string[];
}) {
  const canonicalUrl = normalizeCanonicalUrl(input.canonicalUrl);
  const summary = normalizeStorySummary(input.summary) || input.title.trim();

  return storySchema.parse({
    storyId: `story_${hashValue(
      `${input.sourceId}:${canonicalUrl}:${input.publishedAt}:${input.title}`,
    )}`,
    title: input.title.trim(),
    canonicalUrl,
    bodyText: input.bodyText?.trim() || undefined,
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    sourceType: input.sourceType,
    publishedAt: input.publishedAt,
    summary,
    topics: input.topics,
    regions: input.regions,
    citations: input.citations ?? [
      {
        sourceId: input.sourceId,
        sourceName: input.sourceName,
        url: canonicalUrl,
      },
    ],
    importanceScore: input.importanceScore ?? 0.5,
    personalScore: input.personalScore ?? 0.5,
  });
}

export function clusterStories(stories: Story[]) {
  const clusters: Story[][] = [];

  for (const story of stories) {
    const existing = clusters.find((candidate) =>
      candidate.some((current) => areSameStory(current, story)),
    );

    if (existing) {
      existing.push(story);
      continue;
    }

    clusters.push([story]);
  }

  return clusters.map((storiesInCluster) => {
    const sortedStories = [...storiesInCluster].sort((left, right) => {
      const leftScore = left.personalScore + left.importanceScore;
      const rightScore = right.personalScore + right.importanceScore;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return (
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime()
      );
    });
    const leadStory = sortedStories[0];

    if (!leadStory) {
      throw new Error('clusterStories encountered an empty cluster.');
    }

    const citations = Array.from(
      new Map(
        sortedStories
          .flatMap((story) => story.citations)
          .map((citation) => [
            `${citation.sourceId}:${citation.url}`,
            citation,
          ]),
      ).values(),
    );

    return storyClusterSchema.parse({
      clusterId: `cluster_${hashValue(
        `${leadStory.canonicalUrl}:${sortedStories.map((story) => story.storyId).join(':')}`,
      )}`,
      canonicalUrl: leadStory.canonicalUrl,
      citations,
      headline: leadStory.title,
      importanceScore: leadStory.importanceScore,
      personalScore: leadStory.personalScore,
      publishedAt: leadStory.publishedAt,
      stories: sortedStories,
      storyIds: sortedStories.map((story) => story.storyId),
    });
  });
}
