import { describe, expect, it } from 'vitest';
import { buildMorningBriefing } from './briefing';

describe('buildMorningBriefing', () => {
  it('starts with weather and turns top feed entries into a production script', () => {
    const briefing = buildMorningBriefing({
      date: '2026-04-04T15:00:00.000Z',
      feedSnapshot: {
        entries: [
          {
            canonicalUrl: 'https://example.com/ai-breakthrough',
            citationCount: 2,
            clusterId: 'cluster_1',
            headline: 'New reasoning system released by AI lab',
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
            sourceNames: ['My X Feed', 'Hacker News Homepage'],
            summary: 'A major AI lab released a new reasoning system.',
            topics: ['ai', 'tech'],
          },
          {
            canonicalUrl: 'https://example.com/lantzville-council',
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

    expect(briefing.transcript).toContain('[Lead Anchor | primary]');
    expect(briefing.transcript).toContain(
      'British lead, steady public-radio delivery',
    );
    expect(briefing.transcript).toContain('[Weather Reader | secondary]');
    expect(briefing.transcript).toContain('[calm]');
    expect(briefing.transcript).toContain('[short pause]');
    expect(briefing.transcript).toContain('the weather in Lantzville');
    expect(briefing.transcript).toContain('high of 14');
    expect(briefing.transcript).toContain(
      'New reasoning system released by AI lab',
    );
    expect(briefing.transcript).not.toContain('ANCHOR:');
    expect(briefing.segments[0]).toMatchObject({
      roleLabel: 'Lead Anchor',
      voiceHint: 'British lead, steady public-radio delivery',
      performanceText: expect.stringContaining('[calm]'),
      speaker: 'anchor',
      voiceSlot: 'primary',
    });
    expect(briefing.segments[1]).toMatchObject({
      roleLabel: 'Weather Reader',
      voiceHint: 'British or Irish continuity voice, calm and precise',
      performanceText: expect.stringContaining('[measured]'),
      speaker: 'weather',
      voiceSlot: 'secondary',
    });
  });
});
