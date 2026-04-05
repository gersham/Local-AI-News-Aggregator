import type { FeedEntry, FeedSnapshot } from '@news-aggregator/core';
import { z } from 'zod';
import type { LlmOptions, LlmUsage } from './llm';
import { chatCompletion, getPodcastModel, structuredCompletion } from './llm';
import type { DailyWeatherSummary } from './weather';

export type BriefingSegment = {
  performanceText: string;
  roleLabel: string;
  speaker: 'anchor' | 'correspondent' | 'weather' | 'analyst';
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

const SYSTEM_PROMPT = `You are writing a morning radio show script — think BBC Radio 4's Today programme crossed with the warmth of a local island station. Three hosts who genuinely like each other, riffing on the news over coffee.

## AUDIENCE

A family in LANTZVILLE, BRITISH COLUMBIA, CANADA — a small seaside community on Vancouver Island, just north of Nanaimo. They're getting ready for their day while this plays.

Geographic framing — CRITICAL:
- "Home", "here", "locally" = Lantzville / Vancouver Island / BC. NEVER say "here at home" for Ontario or other provinces.
- BC stories are LOCAL. Frame with familiarity: "Right here on the island...", "Closer to home..."
- Other Canadian provinces are NATIONAL: "Across the country in Ontario...", "Out east..."
- US/UK/international = WORLD news. Frame accordingly.
- Vancouver is ~2 hours by ferry. Victoria is the provincial capital on the island's southern tip.

Audience sensibility:
- Family-friendly, intellectually curious
- Interested in: local BC politics, Canadian national affairs, tech/AI, international geopolitics
- Morning mood: engaging but not stressful — they're having breakfast, not watching a war room
- Seasonal awareness: reference the time of year naturally
- They know Lantzville — no need to explain it, but give context for less familiar places

## THE THREE HOSTS

There are exactly TWO hosts. Do NOT use any other speaker names.

ANCHOR (primary voice slot) — Male. English accent, relaxed — think pub conversation, not Parliament. Warm, conversational, dry wit. Drives the show, sets up stories, handles the big headlines.

CORRESPONDENT (secondary voice slot) — Female. Irish accent. Sharp, warm, occasionally deadpan. Provides depth and colour on stories, reacts to the Anchor, adds local knowledge and context. The one who says "well actually" but makes it charming.

## THE SHOW'S FEEL

This is NOT a news bulletin. It's a SHOW. The two hosts:
- Talk TO each other, not just to the audience
- React to what the other said — "Good lord", "That's wild", "You're not wrong"
- Tease, agree, push back, add colour
- Have opinions (within reason — they're journalists, not pundits)
- Reference each other naturally: "What do you make of that?", "Go on then..."

## MANDATORY SHOW STRUCTURE

1. COLD OPEN (2-3 quick exchanges): Anchor and Correspondent warm up. Weave the weather INTO this naturally — "Fourteen degrees and overcast — not bad for April on the island." Done. Move on.

2. STORIES: Flow naturally from one to the next. The Anchor drives, the Correspondent adds depth, reactions, and colour. They trade off — NOT one person reading 5 stories in a row. NO formal "blocks" or sections — just a conversation that moves through the news. Keep each story to 1-2 segments max.

3. CLOSING (2-3 quick exchanges): Both hosts react to the day's stories, a quip or two, warm sign-off. Brief — 15-20 seconds.

PACING RULE: If a topic has been covered in 2 segments, MOVE ON. No third segment on the same story. Keep things brisk — this is morning radio, not a documentary.

## OUTPUT FORMAT

You MUST output the script in this exact format for each segment:

[Speaker | slot]
voice: {brief voice direction}
{performanceText with ElevenLabs audio tags}

Where Speaker is one of: Anchor, Correspondent
Where slot is one of: primary, secondary

## ELEVENLABS V3 MARKUP — USE IT HEAVILY

You have the full ElevenLabs v3 tag system. Tags go INLINE with spoken text in square brackets. No closing tags.

USE THESE LIBERALLY throughout the script — at least 2-3 tags per segment. They make the difference between a robot reading news and a human telling you about it.

TONE TAGS: [serious tone] [conversational tone] [lighthearted] [reflective] [matter-of-fact] [wistful] [dramatic tone] [measured] [deliberate]

EMOTION TAGS: [calm] [warm] [excited] [concerned] [happy] [sad] [curious] [surprised] [thoughtful] [cheerfully] [playfully] [mischievously] [appalled] [resigned tone]

DELIVERY TAGS: [pause] [emphasized] [drawn out] [rushed] [continues softly] [continues after a beat] [slows down] [rapid-fire] [stress on next word] [understated]

HUMAN TAGS (use for realism): [sigh] [exhales] [clears throat] [laughs] [gasps] [whispers]

PUNCTUATION CONTROL (v3 responds strongly):
- Ellipses (...) — weight, hesitation, dramatic pauses
- Dashes (—) — brief natural pauses
- ALL CAPS — emphasis on that word
- Question marks — rising intonation

EXAMPLES of good markup usage:
- "[conversational tone] So get this... [pause] BC Ferries has done it AGAIN."
- "[laughs] I mean, you couldn't make it up. [continues after a beat] But seriously, for the folks on Texada..."
- "[concerned] And that's [emphasized] 1.4 million mortgages up for renewal by year's end... [exhales] that's a LOT of kitchen-table stress."
- "[playfully] Fourteen degrees and cloud? [pause] I'll have you know that's BEACH weather on the island."

## PACING RULES

- End EVERY segment with trailing ellipsis (...) for a natural pause before the next speaker
- Use "..." generously between topic shifts within a segment
- Use [pause] after greetings, before transitions, and before punchlines
- Vary pacing — some lines [rushed] for energy, some [slows down] for gravity
- The closing should breathe — [warm], ellipses, gentle landing

## SCRIPT WRITING RULES

1. NEVER include structural headings, section labels, or markdown formatting (like **Bold**, "News Block 1", "Cold Open", "Closing Banter"). The output is ONLY [Speaker | slot] segments — nothing else. Everything between segments is spoken aloud.
2. NEVER repeat the headline as the body — rephrase naturally as a person would tell you
2. Weave source attribution in naturally: "The Globe and Mail reports...", "According to CBC..."
3. Filter out internal feed names — "My X Feed", "Hacker News Homepage" are NOT real publications
4. Connect stories — note themes, contrasts, geographic links
5. Weather should feel like a conversation, not a data dump
6. Target 6-8 minutes of spoken content. The TOTAL script should be around 8000-10000 characters including all tags and markup. Give international and tech stories proper coverage — 2-3 sentences each. Local stories can be briefer.
7. Each story: 2-3 sentences. International and tech stories deserve more depth. Local stories can be 1-2 sentences. Move on once the point is made.
8. A few natural exchanges between the hosts — don't force it, but don't make it two separate monologues either. 3-4 genuine reactions across the whole script is plenty.
9. Sound like real people who enjoy working together — not a teleprompter being read`;

function stripStructuralMarkdown(input: string): string {
  return input
    // Remove markdown headings (lines starting with # or **)
    .replace(/^#{1,6}\s+.*$/gmu, '')
    // Remove standalone bold section labels (e.g. **Cold Open**, **News Block 1 – Title**)
    .replace(/^\*\*[^*]+\*\*\s*$/gmu, '')
    // Remove inline bold markers but keep the text
    .replace(/\*\*([^*]+)\*\*/gu, '$1')
    // Collapse excess blank lines
    .replace(/\n{3,}/gu, '\n\n');
}

function parseSegments(rawScript: string): BriefingSegment[] {
  const cleaned = stripStructuralMarkdown(rawScript);
  // Match [Speaker | slot] header, then capture everything until the next header or end
  const segmentPattern =
    /\[(\w+)\s*\|\s*(\w+)\]\s*\n([\s\S]*?)(?=\n\[(?:\w+)\s*\|\s*(?:\w+)\]|\n*$)/gu;
  const segments: BriefingSegment[] = [];
  let match: RegExpExecArray | null;

  match = segmentPattern.exec(cleaned);
  while (match !== null) {
    const [, roleLabel, voiceSlot, rawBody] = match;

    // Extract voice hint if present, then treat remaining lines as performance text
    let voiceHint = '';
    let performanceLines = rawBody.trim();
    const voiceMatch = performanceLines.match(/^voice:\s*(.+)/u);
    if (voiceMatch) {
      const voiceLine = voiceMatch[1].trim();
      // If the voice line contains ElevenLabs tags or substantial text, it's performance text
      const hasPerformanceTags = /\[(?:conversational|warm|serious|calm|happy|excited|concerned|cheerfully|playfully|thoughtful|measured|lighthearted|reflective|matter-of-fact|dramatic|curious|surprised|emphasized|pause|laughs|sigh|exhales|clears throat|rushed|deliberate|mischievously|appalled|resigned|wistful|understated|drawn out|slows down|rapid-fire|stress on next word|continues)/iu.test(voiceLine);
      if (hasPerformanceTags) {
        // The voice line IS the performance text (LLM merged them)
        performanceLines = voiceLine + '\n' + performanceLines.slice(voiceMatch[0].length).trim();
      } else {
        voiceHint = voiceLine;
        performanceLines = performanceLines.slice(voiceMatch[0].length).trim();
      }
    }

    const cleanPerformanceText = performanceLines.trim();
    const cleanText = cleanPerformanceText
      .replace(/\[[^\]]*\]/gu, '')
      .replace(/\s{2,}/gu, ' ')
      .trim();

    if (!cleanText) {
      match = segmentPattern.exec(cleaned);
      continue;
    }

    const speakerMap: Record<string, BriefingSegment['speaker']> = {
      anchor: 'anchor',
      correspondent: 'correspondent',
      weather: 'correspondent',
      analyst: 'correspondent',
    };

    const slotMap: Record<string, BriefingSegment['voiceSlot']> = {
      primary: 'primary',
      secondary: 'secondary',
      tertiary: 'secondary',
    };

    segments.push({
      performanceText: cleanPerformanceText,
      roleLabel: roleLabel,
      speaker: speakerMap[roleLabel.toLowerCase()] ?? 'anchor',
      text: cleanText,
      voiceHint: voiceHint,
      voiceSlot: slotMap[voiceSlot.toLowerCase()] ?? 'primary',
    });

    match = segmentPattern.exec(cleaned);
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
  const sportsFilter = /\bsports?\b|\bnhl\b|\bnfl\b|\bnba\b|\bmlb\b|\bmls\b|\bfifa\b|\bpremier league\b|\bplayoff\b|\bplayoffs\b|\bsabres\b|\bcanucks\b|\bhockey\b|\bfootball\b|\bbaseball\b|\bbasketball\b|\bsoccer\b|\btennis\b|\bgolf\b|\bolympic/iu;
  const allEntries = input.feedSnapshot.entries.filter(
    (e) =>
      !e.topics.some((t) => sportsFilter.test(t)) &&
      !sportsFilter.test(e.headline),
  );
  const spokenDate = formatSpokenDate(input.date, input.weather.timezone);

  // --- Pass 1: Curation (fast model) ---
  // Send brief summaries of all items, LLM picks the best 5-10 by ID

  const curationPrompt = `You are curating stories for a morning news briefing podcast for a family in Lantzville, BC, Canada.

Date: ${spokenDate}

Here are ALL available stories (${allEntries.length} total). Each has an [ID] you must reference.

${buildBriefSummaries(allEntries)}

Select 12-16 stories that make a compelling, balanced morning briefing. The content mix MUST be:

- 2-3 LOCAL stories (Vancouver Island, BC, or Canada) — no more than this, keep local tight
- 4-5 INTERNATIONAL stories (world affairs, geopolitics, conflicts, global events) — this is the BIGGEST category, the audience wants to know what's happening in the world
- 3-4 TECH stories (AI, technology, startups, science)
- 2-3 INTERESTING FILLER (science discoveries, culture, human interest, space, anything surprising)

CRITICAL: Do NOT over-index on local news. The audience lives locally — they already know about fishing and poop bins. They want WORLD perspective. International and tech stories should dominate.

Weather is always included separately — don't count it as a story slot.

Additional rules:
- ABSOLUTELY NO SPORTS stories — no hockey, football, basketball, soccer, baseball, tennis, golf, Olympics, NHL, NFL, NBA, MLS, FIFA, or any athletic competition. Skip them entirely.
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
    maxOutputTokens: 8000,
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
