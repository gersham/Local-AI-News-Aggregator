import { describe, expect, it, vi } from 'vitest';
import { buildMorningBriefing } from './briefing';

vi.mock('./llm', () => ({
  chatCompletion: vi.fn().mockResolvedValue({
    text: `[Anchor | primary]
voice: BBC lead presenter, warm and authoritative
[warm] Good morning. [pause] It's Saturday, the 4th of April 2026. Here's your morning briefing.

[Weather | secondary]
voice: Scottish weather presenter, clear and friendly
[measured] Let's look at the weather. In Lantzville today, expect highs of around 14 degrees under overcast skies. [pause] There's a 45 percent chance of rain, so keep an umbrella handy.

[Anchor | primary]
voice: BBC lead presenter, warm and authoritative
[serious tone] Now to the news. A major AI lab has released a new reasoning system that's generating significant attention across the tech world.

[Analyst | tertiary]
voice: Irish correspondent, thoughtful delivery
[reflective] And closer to home, Lantzville council has approved a waterfront development plan. [pause] That's according to BC News.

[Anchor | primary]
voice: BBC lead presenter, warm and authoritative
[warm] That's your briefing for this morning. Have a good day.`,
    usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800, estimatedCostUsd: 0.0003 },
  }),
  structuredCompletion: vi.fn().mockResolvedValue({
    object: ['cluster_1', 'cluster_2'],
    usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120, estimatedCostUsd: 0.0001 },
  }),
  getDefaultModel: vi.fn().mockReturnValue('grok-4-1-fast-non-reasoning'),
  getPodcastModel: vi.fn().mockReturnValue('grok-4.20-0309-non-reasoning'),
}));

describe('buildMorningBriefing', () => {
  it('generates a multi-voice BBC-style briefing via LLM', async () => {
    const briefing = await buildMorningBriefing({
      date: '2026-04-04T15:00:00.000Z',
      feedSnapshot: {
        entries: [
          {
            canonicalUrl: 'https://example.com/ai',
            citationCount: 2,
            clusterId: 'cluster_1',
            headline: 'New reasoning system released',
            publishedAt: '2026-04-04T14:20:00.000Z',
            rank: 1,
            ranking: {
              baseScore: 0.67,
              corroborationScore: 0.05,
              freshnessScore: 0.18,
              sourceTypeScore: 0.06,
              totalScore: 0.96,
            },
            reasons: ['Fresh within the last day.'],
            regions: ['global'],
            sourceCount: 2,
            sourceNames: ['Tech News', 'AI Weekly'],
            summary: 'A major AI lab released a new reasoning system.',
            topics: ['ai', 'tech'],
          },
          {
            canonicalUrl: 'https://example.com/lantzville',
            citationCount: 1,
            clusterId: 'cluster_2',
            headline: 'Lantzville council approves waterfront plan',
            publishedAt: '2026-04-04T09:00:00.000Z',
            rank: 2,
            ranking: {
              baseScore: 0.56,
              corroborationScore: 0.03,
              freshnessScore: 0.15,
              sourceTypeScore: 0.05,
              totalScore: 0.79,
            },
            reasons: ['Strong personal relevance.'],
            regions: ['bc', 'canada'],
            sourceCount: 1,
            sourceNames: ['BC News'],
            summary: 'Lantzville council approved a waterfront plan update.',
            topics: ['bc', 'canada'],
          },
        ],
        generatedAt: '2026-04-04T15:00:00.000Z',
      },
      weather: {
        conditionSummary: 'Overcast',
        locationName: 'Lantzville',
        precipitationProbabilityMax: 45,
        temperatureHighC: 14.2,
        timezone: 'America/Vancouver',
      },
    });

    // Has parsed segments
    expect(briefing.segments.length).toBeGreaterThan(0);

    // Has correct voice slots
    const slots = briefing.segments.map((s) => s.voiceSlot);
    expect(slots).toContain('primary');
    expect(slots).toContain('secondary');

    // Transcript contains voice markup
    expect(briefing.transcript).toContain('[Anchor | primary]');
    expect(briefing.transcript).toContain('voice:');

    // Segments have correct structure
    expect(briefing.segments[0]).toMatchObject({
      roleLabel: 'Anchor',
      speaker: 'anchor',
      voiceSlot: 'primary',
    });

    // Performance text has audio tags, clean text doesn't
    const anchorSegment = briefing.segments[0];
    expect(anchorSegment.performanceText).toContain('[');
    expect(anchorSegment.text).not.toMatch(/\[.*?\]/u);
  });
});
