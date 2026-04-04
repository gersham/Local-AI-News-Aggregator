import type { FeedSnapshot } from '@news-aggregator/core';
import type { DailyWeatherSummary } from './weather';

export type BriefingSegment = {
  performanceText: string;
  roleLabel: string;
  speaker: 'anchor' | 'weather' | 'analyst';
  text: string;
  voiceHint: string;
  voiceSlot: 'primary' | 'secondary' | 'tertiary';
};

export type MorningBriefing = {
  segments: BriefingSegment[];
  transcript: string;
};

function formatBriefingDate(input: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone,
    weekday: 'long',
    year: 'numeric',
  }).format(new Date(input));
}

function roundTemperature(value: number) {
  return Math.round(value);
}

function withPerformanceTags(tags: string[], text: string) {
  const prefix = tags.map((tag) => `[${tag}]`).join(' ');

  return `${prefix} ${text}`.trim();
}

function renderTranscriptSegment(segment: BriefingSegment) {
  return [
    `[${segment.roleLabel} | ${segment.voiceSlot}]`,
    `voice: ${segment.voiceHint}`,
    segment.performanceText,
  ].join('\n');
}

export function buildMorningBriefing(input: {
  date: string;
  feedSnapshot: FeedSnapshot;
  maxStories?: number;
  weather: DailyWeatherSummary;
}): MorningBriefing {
  const headlineCount = input.maxStories ?? 4;
  const topStories = input.feedSnapshot.entries.slice(0, headlineCount);
  const spokenDate = formatBriefingDate(input.date, input.weather.timezone);

  const segments: BriefingSegment[] = [
    {
      performanceText: withPerformanceTags(
        ['calm', 'composed'],
        `Good morning. [short pause] It is ${spokenDate}. [short pause] Here is your morning briefing.`,
      ),
      roleLabel: 'Lead Anchor',
      speaker: 'anchor',
      text: `Good morning. It is ${spokenDate}. Here is your morning briefing.`,
      voiceHint: 'British lead, steady public-radio delivery',
      voiceSlot: 'primary',
    },
    {
      performanceText: withPerformanceTags(
        ['measured', 'clear'],
        `First, the weather in ${input.weather.locationName}. [short pause] Expect a high of ${roundTemperature(
          input.weather.temperatureHighC,
        )} degrees Celsius, ${input.weather.conditionSummary.toLowerCase()}, with a ${Math.round(
          input.weather.precipitationProbabilityMax,
        )} percent chance of rain.`,
      ),
      roleLabel: 'Weather Reader',
      speaker: 'weather',
      text: `First, the weather in ${input.weather.locationName}. Expect a high of ${roundTemperature(
        input.weather.temperatureHighC,
      )} degrees Celsius, ${input.weather.conditionSummary.toLowerCase()}, with a ${Math.round(
        input.weather.precipitationProbabilityMax,
      )} percent chance of rain.`,
      voiceHint: 'British or Irish continuity voice, calm and precise',
      voiceSlot: 'secondary',
    },
    {
      performanceText: withPerformanceTags(
        ['steady'],
        `Now the top stories. [short pause] I have ${topStories.length} items to watch this morning.`,
      ),
      roleLabel: 'Lead Anchor',
      speaker: 'anchor',
      text: `Now the top stories. I have ${topStories.length} items to watch this morning.`,
      voiceHint: 'British lead, steady public-radio delivery',
      voiceSlot: 'primary',
    },
    ...topStories.map((entry, index): BriefingSegment => {
      const speaker = index % 2 === 0 ? 'anchor' : 'analyst';

      return {
        performanceText: withPerformanceTags(
          index === 0 ? ['confident'] : ['analytical'],
          index === 0
            ? `Our lead story: ${entry.headline}. [short pause] ${entry.summary} [short pause] Reported across ${entry.sourceCount} sources.`
            : `Another story to watch: ${entry.headline}. [short pause] ${entry.summary}`,
        ),
        roleLabel: speaker === 'anchor' ? 'Lead Anchor' : 'Analyst',
        speaker,
        text:
          index === 0
            ? `Our lead story: ${entry.headline}. ${entry.summary} Reported across ${entry.sourceCount} sources.`
            : `Story ${index + 1}. ${entry.headline}. ${entry.summary}`,
        voiceHint:
          speaker === 'anchor'
            ? 'British lead, steady public-radio delivery'
            : 'Irish or English analyst voice, reflective and concise',
        voiceSlot: speaker === 'anchor' ? 'primary' : 'tertiary',
      };
    }),
    {
      performanceText: withPerformanceTags(
        ['warm'],
        'That concludes your morning briefing.',
      ),
      roleLabel: 'Lead Anchor',
      speaker: 'anchor',
      text: 'That concludes your morning briefing.',
      voiceHint: 'British lead, steady public-radio delivery',
      voiceSlot: 'primary',
    },
  ];

  return {
    segments,
    transcript: segments.map(renderTranscriptSegment).join('\n\n'),
  };
}
