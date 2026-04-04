import { describe, expect, it } from 'vitest';
import { clusterStories, normalizeStoryCandidate } from './index';

describe('normalizeStoryCandidate', () => {
  it('normalizes canonical URLs and seeds a citation', () => {
    const story = normalizeStoryCandidate({
      canonicalUrl: 'https://example.com/story?utm_source=x&ref=home',
      personalScore: 0.72,
      publishedAt: '2026-04-04T12:00:00.000Z',
      regions: ['global'],
      sourceId: 'hn-home',
      sourceName: 'Hacker News Homepage',
      sourceType: 'news-site',
      summary: 'An AI startup released a new benchmark model.',
      title: 'AI startup releases benchmark model',
      topics: ['ai', 'tech'],
    });

    expect(story.canonicalUrl).toBe('https://example.com/story');
    expect(story.citations).toEqual([
      {
        sourceId: 'hn-home',
        sourceName: 'Hacker News Homepage',
        url: 'https://example.com/story',
      },
    ]);
    expect(story.storyId).toMatch(/^story_/);
  });
});

describe('clusterStories', () => {
  it('clusters duplicate stories by canonical URL', () => {
    const first = normalizeStoryCandidate({
      canonicalUrl: 'https://example.com/story?utm_source=hn',
      publishedAt: '2026-04-04T12:00:00.000Z',
      regions: ['global'],
      sourceId: 'hn-home',
      sourceName: 'Hacker News Homepage',
      sourceType: 'news-site',
      summary: 'An AI startup released a new benchmark model.',
      title: 'AI startup releases benchmark model',
      topics: ['ai'],
    });
    const second = normalizeStoryCandidate({
      canonicalUrl: 'https://example.com/story',
      publishedAt: '2026-04-04T12:30:00.000Z',
      regions: ['global'],
      sourceId: 'bc-news-search',
      sourceName: 'BC News',
      sourceType: 'watchlist',
      summary: 'Coverage of the same AI startup release.',
      title: 'AI startup releases benchmark model',
      topics: ['ai'],
    });

    const clusters = clusterStories([first, second]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.canonicalUrl).toBe('https://example.com/story');
    expect(clusters[0]?.storyIds).toHaveLength(2);
    expect(clusters[0]?.storyIds).toEqual(
      expect.arrayContaining([first.storyId, second.storyId]),
    );
    expect(clusters[0]?.citations).toHaveLength(2);
  });

  it('clusters highly similar same-day titles even when URLs differ', () => {
    const first = normalizeStoryCandidate({
      canonicalUrl: 'https://example.com/ai-model',
      publishedAt: '2026-04-04T13:00:00.000Z',
      regions: ['global'],
      sourceId: 'x-my-feed',
      sourceName: 'My X Feed',
      sourceType: 'social',
      summary: 'OpenAI released a new reasoning model.',
      title: 'OpenAI releases new reasoning model',
      topics: ['ai'],
    });
    const second = normalizeStoryCandidate({
      canonicalUrl: 'https://another.example.com/openai-model',
      publishedAt: '2026-04-04T13:20:00.000Z',
      regions: ['global'],
      sourceId: 'hn-home',
      sourceName: 'Hacker News Homepage',
      sourceType: 'news-site',
      summary: 'Another source on the same model release.',
      title: 'New reasoning model released by OpenAI',
      topics: ['ai'],
    });

    const clusters = clusterStories([first, second]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.stories).toHaveLength(2);
  });
});
