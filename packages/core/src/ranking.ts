import {
  type FeedEntry,
  type FeedSnapshot,
  feedSnapshotSchema,
  type Story,
  type StoryCluster,
} from './domain';

const sourceTypePriority: Record<Story['sourceType'], number> = {
  custom: 0.55,
  'news-site': 1,
  newsletter: 0.8,
  social: 0.65,
  watchlist: 0.9,
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getHoursOld(publishedAt: string, generatedAt: string) {
  return Math.max(
    0,
    (new Date(generatedAt).getTime() - new Date(publishedAt).getTime()) /
      (1000 * 60 * 60),
  );
}

function getLeadStory(cluster: StoryCluster) {
  return [...cluster.stories].sort((left, right) => {
    const typeDelta =
      sourceTypePriority[right.sourceType] -
      sourceTypePriority[left.sourceType];

    if (typeDelta !== 0) {
      return typeDelta;
    }

    const rightScore = right.personalScore + right.importanceScore;
    const leftScore = left.personalScore + left.importanceScore;

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return (
      new Date(right.publishedAt).getTime() -
      new Date(left.publishedAt).getTime()
    );
  })[0];
}

function buildReasons(input: {
  citationCount: number;
  freshnessRaw: number;
  personalScore: number;
}) {
  const reasons: string[] = [];

  if (input.personalScore >= 0.7) {
    reasons.push('Strong personal relevance.');
  }

  if (input.citationCount > 1) {
    reasons.push(`Corroborated by ${input.citationCount} citations.`);
  }

  if (input.freshnessRaw >= 0.67) {
    reasons.push('Fresh within the last day.');
  }

  if (reasons.length === 0) {
    reasons.push('Included on baseline ranking.');
  }

  return reasons;
}

export function scoreStoryCluster(
  cluster: StoryCluster,
  options: {
    generatedAt: string;
  },
) {
  const leadStory = getLeadStory(cluster);

  if (!leadStory) {
    throw new Error('scoreStoryCluster requires at least one story.');
  }

  const ageHours = getHoursOld(cluster.publishedAt, options.generatedAt);
  const freshnessRaw = clamp01(1 - ageHours / 72);
  const corroborationRaw = clamp01(cluster.citations.length / 3);
  const sourceTypeRaw = sourceTypePriority[leadStory.sourceType];

  const baseScore = clamp01(
    leadStory.personalScore * 0.34 + leadStory.importanceScore * 0.34,
  );
  const freshnessScore = clamp01(freshnessRaw * 0.18);
  const corroborationScore = clamp01(corroborationRaw * 0.08);
  const sourceTypeScore = clamp01(sourceTypeRaw * 0.06);
  const totalScore = clamp01(
    baseScore + freshnessScore + corroborationScore + sourceTypeScore,
  );

  return {
    leadStory,
    ranking: {
      baseScore,
      corroborationScore,
      freshnessScore,
      sourceTypeScore,
      totalScore,
    },
    reasons: buildReasons({
      citationCount: cluster.citations.length,
      freshnessRaw,
      personalScore: leadStory.personalScore,
    }),
  };
}

export function materializeFeedSnapshot(
  clusters: StoryCluster[],
  options: {
    generatedAt: string;
  },
): FeedSnapshot {
  const entries = clusters
    .map((cluster) => {
      const scored = scoreStoryCluster(cluster, options);
      const topicSet = new Set(
        cluster.stories.flatMap((story) => story.topics),
      );
      const regionSet = new Set(
        cluster.stories.flatMap((story) => story.regions),
      );
      const sourceNames = Array.from(
        new Set(cluster.citations.map((citation) => citation.sourceName)),
      );

      return {
        canonicalUrl: cluster.canonicalUrl,
        citationCount: cluster.citations.length,
        clusterId: cluster.clusterId,
        headline: scored.leadStory.title,
        publishedAt: cluster.publishedAt,
        ranking: scored.ranking,
        reasons: scored.reasons,
        regions: Array.from(regionSet),
        sourceCount: sourceNames.length,
        sourceNames,
        summary: scored.leadStory.summary,
        topics: Array.from(topicSet),
      };
    })
    .sort((left, right) => {
      if (right.ranking.totalScore !== left.ranking.totalScore) {
        return right.ranking.totalScore - left.ranking.totalScore;
      }

      return (
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime()
      );
    })
    .map(
      (entry, index): FeedEntry => ({
        ...entry,
        rank: index + 1,
      }),
    );

  return feedSnapshotSchema.parse({
    entries,
    generatedAt: options.generatedAt,
  });
}
