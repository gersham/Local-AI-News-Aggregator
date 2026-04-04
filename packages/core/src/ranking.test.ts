import { describe, expect, it } from 'vitest';
import {
  clusterStories,
  materializeFeedSnapshot,
  normalizeStoryCandidate,
} from './index';

describe('materializeFeedSnapshot', () => {
  it('ranks corroborated fresh stories above stale single-source stories', () => {
    const corroboratedStories = clusterStories([
      normalizeStoryCandidate({
        canonicalUrl: 'https://example.com/ai-breakthrough?utm_source=x',
        importanceScore: 0.86,
        personalScore: 0.9,
        publishedAt: '2026-04-04T14:00:00.000Z',
        regions: ['global'],
        sourceId: 'x-my-feed',
        sourceName: 'My X Feed',
        sourceType: 'social',
        summary: 'A major AI lab released a new reasoning system.',
        title: 'AI lab releases new reasoning system',
        topics: ['ai', 'tech'],
      }),
      normalizeStoryCandidate({
        canonicalUrl: 'https://example.com/ai-breakthrough',
        importanceScore: 0.8,
        personalScore: 0.82,
        publishedAt: '2026-04-04T14:20:00.000Z',
        regions: ['global'],
        sourceId: 'hn-home',
        sourceName: 'Hacker News Homepage',
        sourceType: 'news-site',
        summary: 'The same AI release is now spreading broadly.',
        title: 'New reasoning system released by AI lab',
        topics: ['ai', 'tech'],
      }),
    ]);
    const staleStories = clusterStories([
      normalizeStoryCandidate({
        canonicalUrl: 'https://example.com/legacy-tech',
        importanceScore: 0.75,
        personalScore: 0.78,
        publishedAt: '2026-04-01T08:00:00.000Z',
        regions: ['global'],
        sourceId: 'bc-news-search',
        sourceName: 'BC News',
        sourceType: 'watchlist',
        summary: 'Older technology coverage.',
        title: 'Older technology coverage',
        topics: ['tech'],
      }),
    ]);

    const snapshot = materializeFeedSnapshot(
      [...corroboratedStories, ...staleStories],
      {
        generatedAt: '2026-04-04T15:00:00.000Z',
      },
    );

    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[0]?.headline).toBe(
      'New reasoning system released by AI lab',
    );
    expect(snapshot.entries[0]?.ranking.totalScore).toBeGreaterThan(
      snapshot.entries[1]?.ranking.totalScore ?? 0,
    );
    expect(snapshot.entries[0]?.reasons).toEqual(
      expect.arrayContaining([
        'Strong personal relevance.',
        'Corroborated by 2 citations.',
        'Fresh within the last day.',
      ]),
    );
  });

  it('emits explainable ranking metadata for feed entries', () => {
    const clusters = clusterStories([
      normalizeStoryCandidate({
        canonicalUrl: 'https://example.com/lantzville-council',
        importanceScore: 0.7,
        personalScore: 0.74,
        publishedAt: '2026-04-04T09:00:00.000Z',
        regions: ['bc', 'canada'],
        sourceId: 'bc-news-search',
        sourceName: 'BC News',
        sourceType: 'watchlist',
        summary: 'Lantzville council approved a waterfront plan update.',
        title: 'Lantzville council approves waterfront plan',
        topics: ['bc', 'canada'],
      }),
    ]);

    const snapshot = materializeFeedSnapshot(clusters, {
      generatedAt: '2026-04-04T10:00:00.000Z',
    });
    const entry = snapshot.entries[0];

    expect(entry).toMatchObject({
      citationCount: 1,
      rank: 1,
      sourceCount: 1,
      sourceNames: ['BC News'],
      topics: ['bc', 'canada'],
    });
    expect(entry?.ranking).toMatchObject({
      baseScore: expect.any(Number),
      corroborationScore: expect.any(Number),
      freshnessScore: expect.any(Number),
      sourceTypeScore: expect.any(Number),
      totalScore: expect.any(Number),
    });
  });
});
