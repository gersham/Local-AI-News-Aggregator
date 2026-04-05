import type { FeedEntry, FeedSnapshot } from '@news-aggregator/core';
import { z } from 'zod';
import type { LlmOptions, LlmUsage } from './llm';
import { chatCompletion, getPodcastModel, structuredCompletion } from './llm';
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
  usage?: LlmUsage;
};

function formatSpokenDate(input: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone,
    weekday: 'long',
    year: 'numeric',
  }).format(new Date(input));
}

function buildBriefSummaries(entries: FeedEntry[]) {
  return entries
    .map(
      (entry) =>
        `[${entry.clusterId}] ${entry.headline} — ${entry.summary.slice(0, 120)}${entry.summary.length > 120 ? '...' : ''} (${entry.topics.join(', ') || 'general'} | ${entry.regions.join(', ') || 'global'} | ${entry.sourceCount} sources | score ${entry.ranking.totalScore.toFixed(2)})`,
    )
    .join('\n');
}

function buildFullStoryContext(entries: FeedEntry[]) {
  return entries
    .map(
      (entry) =>
        `ID: ${entry.clusterId}
Headline: ${entry.headline}
Summary: ${entry.summary}
${entry.bodyText ? `Full article:\n${entry.bodyText.slice(0, 4000)}` : ''}
Sources: ${entry.sourceNames.join(', ')}
Topics: ${entry.topics.join(', ') || 'general'}
Regions: ${entry.regions.join(', ') || 'global'}
Citations: ${entry.citationCount}`,
    )
    .join('\n\n---\n\n');
}

const SYSTEM_PROMPT = `You are a BBC-style news podcast script writer. You write scripts for a personal morning briefing podcast.

## AUDIENCE

This podcast is a morning briefing for a family living in LANTZVILLE, BRITISH COLUMBIA, CANADA. Lantzville is a small seaside community on Vancouver Island, just north of Nanaimo.

Geographic framing rules — these are CRITICAL:
- "Home", "here", "locally" = Lantzville / Vancouver Island / BC. NEVER use "here at home" for Ontario, Alberta, or other provinces.
- BC stories are LOCAL news. Frame them with familiarity: "Right here on the island...", "Closer to home in BC..."
- Other Canadian provinces are NATIONAL news. Frame as: "Across the country in Ontario...", "Out east...", "On the prairies..."
- US/UK/international stories are WORLD news. Frame accordingly.
- Vancouver is the nearest major city (~2 hours away by ferry). Victoria is the provincial capital on the southern tip of the island.

Audience sensibility:
- Family-friendly, intellectually curious household
- Interested in: local BC politics, Canadian national affairs, tech/AI, international geopolitics
- Morning context: people are getting ready for their day — keep it engaging but not stressful
- Seasonal awareness: reference the time of year naturally (west coast rain in winter, summer warmth, etc.)
- The family knows Lantzville well — no need to explain where it is, but DO give context for less familiar places

## VOICES

Three distinct voices deliver the briefing:

ANCHOR (primary voice slot) — The lead presenter. Think BBC Radio 4 Today programme. Authoritative but warm, conversational, guides the listener through the bulletin. British RP accent.

WEATHER (secondary voice slot) — The weather presenter. Clear, measured, friendly. Think BBC shipping forecast meets local radio. Slightly different accent — perhaps Welsh or Scottish for variety.

ANALYST (tertiary voice slot) — The correspondent/analyst. Provides depth and context on stories. Thoughtful, occasionally wry. Think BBC correspondent filing from the scene. Irish or Northern English accent for contrast.

## OUTPUT FORMAT

You MUST output the script in this exact format for each segment:

[Speaker | slot]
voice: {brief voice direction}
{performanceText with ElevenLabs audio tags}

Where Speaker is one of: Anchor, Weather, Analyst
Where slot is one of: primary, secondary, tertiary

## ELEVENLABS V3 COMPLETE MARKUP REFERENCE

You have access to the full ElevenLabs v3 audio tag system. Tags use square brackets and go INLINE with spoken text. No closing tags — effects end naturally.

TONE/NARRATOR TAGS (set the overall delivery feel):
[serious tone] [conversational tone] [lighthearted] [reflective] [matter-of-fact] [wistful] [dramatic tone] [measured] [deliberate]

EMOTIONAL STATE TAGS (convey speaker feeling):
[calm] [warm] [excited] [concerned] [happy] [sad] [angry] [annoyed] [curious] [surprised] [thoughtful] [cheerfully] [playfully] [mischievously] [appalled] [resigned tone]

DELIVERY/PACING TAGS (control rhythm and emphasis):
[pause] — a natural beat or breath
[emphasized] — stress the next phrase
[drawn out] — elongate/slow delivery
[rushed] — speed up delivery
[continues softly] — lower intensity
[continues after a beat] — brief reflective pause then resume
[slows down] — decelerate pacing
[rapid-fire] — fast staccato delivery
[stress on next word] — emphasis on single word
[understated] — downplay delivery
[timidly] — quiet, hesitant

HUMAN REACTION TAGS (add realism — use sparingly):
[sigh] [exhales] [clears throat] [laughs] [gasps] [whispers]

PUNCTUATION-BASED CONTROL (v3 responds strongly to these):
- Ellipses (...) — add weight, hesitation, dramatic pauses between sections
- Dashes (—) — brief natural pauses within sentences
- ALL CAPS on a word — increased emphasis on that word
- Question marks — rising intonation

## CRITICAL: PACING AND SECTION BREAKS

This is a PODCAST. Listeners need breathing room between topics. You MUST:
- End EVERY segment with an ellipsis (...) to create a natural trailing pause before the next speaker
- Use "..." between the sign-off of one topic and the intro of the next within a single speaker's segment
- Add [pause] after the opening greeting before diving into weather
- Add [pause] or "..." before transitioning from weather to news stories
- Between stories, use natural transitions WITH pauses: "... Now, turning to..." or "... Meanwhile..."
- The closing sign-off should have [warm] and start with "..." for a gentle landing

## SCRIPT WRITING RULES

1. NEVER repeat the headline as the body — the summary IS the story, rephrase it naturally
2. Weave source attribution naturally: "The Globe and Mail reports...", "According to CBC...", "Sources close to..."
3. Filter out internal feed names — "My X Feed", "Hacker News Homepage" are NOT real publications. Only cite actual news organizations.
4. Add connective tissue between stories — note themes, contrasts, geographic connections
5. Weather should feel like a natural conversation, not a data readout
6. Open warmly with the date, close warmly
7. Target 3-5 minutes of spoken content total
8. Each story: 2-4 sentences, no more. Be tight.
9. The Anchor handles transitions and the lead story. The Analyst picks up 2-3 stories. They occasionally reference each other naturally.
10. Make it sound like real people talking, not a script being read.`;

function parseSegments(rawScript: string): BriefingSegment[] {
  const segmentPattern =
    /\[(\w+)\s*\|\s*(\w+)\]\s*\nvoice:\s*(.+)\n([\s\S]*?)(?=\n\[(?:\w+)\s*\|\s*(?:\w+)\]|\n*$)/gu;
  const segments: BriefingSegment[] = [];
  let match: RegExpExecArray | null;

  match = segmentPattern.exec(rawScript);
  while (match !== null) {
    const [, roleLabel, voiceSlot, voiceHint, performanceText] = match;
    const cleanPerformanceText = performanceText.trim();
    const cleanText = cleanPerformanceText
      .replace(/\[[^\]]*\]/gu, '')
      .replace(/\s{2,}/gu, ' ')
      .trim();

    const speakerMap: Record<string, BriefingSegment['speaker']> = {
      anchor: 'anchor',
      weather: 'weather',
      analyst: 'analyst',
    };

    const slotMap: Record<string, BriefingSegment['voiceSlot']> = {
      primary: 'primary',
      secondary: 'secondary',
      tertiary: 'tertiary',
    };

    segments.push({
      performanceText: cleanPerformanceText,
      roleLabel: roleLabel,
      speaker: speakerMap[roleLabel.toLowerCase()] ?? 'anchor',
      text: cleanText,
      voiceHint: voiceHint.trim(),
      voiceSlot: slotMap[voiceSlot.toLowerCase()] ?? 'primary',
    });

    match = segmentPattern.exec(rawScript);
  }

  return segments;
}

export async function buildMorningBriefing(input: {
  date: string;
  feedSnapshot: FeedSnapshot;
  llm?: LlmOptions;
  maxStories?: number;
  weather: DailyWeatherSummary;
}): Promise<MorningBriefing> {
  const allEntries = input.feedSnapshot.entries;
  const spokenDate = formatSpokenDate(input.date, input.weather.timezone);

  // --- Pass 1: Curation (fast model) ---
  // Send brief summaries of all items, LLM picks the best 5-10 by ID

  const curationPrompt = `You are curating stories for a morning news briefing podcast for a family in Lantzville, BC, Canada.

Date: ${spokenDate}

Here are ALL available stories (${allEntries.length} total). Each has an [ID] you must reference.

${buildBriefSummaries(allEntries)}

Select 8-12 stories that make a compelling, balanced morning briefing. The content mix should be roughly:

- ~1/4 LOCAL news (Lantzville, Vancouver Island, BC, or Canada) — this is home
- ~1/4 INTERNATIONAL news (world affairs, geopolitics, global events)
- ~1/4 TECH news (AI, technology, startups, science)
- ~1/4 INTERESTING FILLER (science discoveries, culture, human interest, anything surprising or thought-provoking)

Weather is always included separately — don't count it as a story slot.

Additional rules:
- NO duplicate stories about the same event — pick the best angle
- Skip stale, trivial, or low-substance items
- Lead with the most important or impactful story regardless of category

Return ONLY a JSON array of the selected story IDs, in the order they should appear in the briefing. Example: ["cluster_abc123", "cluster_def456"]`;

  const { object: selectedIds } = await structuredCompletion({
    ...input.llm,
    system: 'You are a news editor selecting stories for a morning briefing.',
    prompt: curationPrompt,
    schema: z.array(z.string()),
  });

  const selectedSet = new Set(selectedIds);
  const selectedEntries = allEntries.filter((e) => selectedSet.has(e.clusterId));

  // Fallback: if curation returned nothing usable, take top 8 by rank
  const finalEntries =
    selectedEntries.length > 0
      ? selectedEntries
      : allEntries.slice(0, 8);

  // --- Pass 2: Script generation (podcast model, full context) ---

  const scriptPrompt = `Write a BBC-style morning news briefing podcast script.

Date: ${spokenDate}

Weather data:
- Location: ${input.weather.locationName}
- High: ${Math.round(input.weather.temperatureHighC)}°C
- Conditions: ${input.weather.conditionSummary}
- Rain chance: ${Math.round(input.weather.precipitationProbabilityMax)}%

SELECTED STORIES (${finalEntries.length} — use ALL of these in the briefing):

${buildFullStoryContext(finalEntries)}

Write the complete script now. Use the exact segment format, include ElevenLabs audio tags for natural delivery, and make it sound like a real BBC bulletin. Use the full article text where provided for richer, more detailed coverage.`;

  const { text: rawScript, usage } = await chatCompletion({
    ...input.llm,
    model: input.llm?.model ?? getPodcastModel(),
    system: SYSTEM_PROMPT,
    prompt: scriptPrompt,
    maxOutputTokens: 4000,
  });

  const segments = parseSegments(rawScript);

  if (segments.length === 0) {
    throw new Error(
      `LLM produced no parseable segments. Raw output:\n${rawScript.slice(0, 500)}`,
    );
  }

  return {
    segments,
    transcript: rawScript.trim(),
    usage,
  };
}
