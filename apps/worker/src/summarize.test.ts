import { describe, expect, it, vi } from 'vitest';
import { summarizeArticle, summarizeArticleBatch } from './summarize';

vi.mock('./llm', () => ({
  structuredCompletion: vi.fn().mockResolvedValue({
    object: {
      summary:
        'The city council has approved a new waterfront development plan that will transform the harbour area.',
      topics: ['development', 'local'],
      regions: ['bc'],
    },
    usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300, estimatedCostUsd: 0.0001 },
  }),
  chatCompletion: vi.fn(),
}));

describe('summarizeArticle', () => {
  it('returns an LLM-generated summary for articles with body text', async () => {
    const result = await summarizeArticle({
      title: 'Council approves waterfront plan',
      sourceName: 'BC News',
      bodyText:
        'The city council voted 5-2 to approve the new waterfront development plan...',
      topics: ['bc'],
      regions: ['bc'],
    });

    expect(result.summary).toContain('waterfront');
    expect(result.topics).toContain('development');
  });

  it('falls back to raw summary when no body text available', async () => {
    const result = await summarizeArticle({
      title: 'Breaking news',
      sourceName: 'Test',
      rawSummary: 'Something happened.',
      topics: [],
      regions: [],
    });

    expect(result.summary).toBe('Something happened.');
  });
});

describe('summarizeArticleBatch', () => {
  it('processes multiple articles', async () => {
    const results = await summarizeArticleBatch([
      {
        title: 'Story 1',
        sourceName: 'Source 1',
        bodyText: 'Content 1...',
      },
      {
        title: 'Story 2',
        sourceName: 'Source 2',
        bodyText: 'Content 2...',
      },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].summary).toContain('waterfront');
  });
});
