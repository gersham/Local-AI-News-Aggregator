import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { BriefingSegment, MorningBriefing } from './briefing';

export type BriefingVoices = {
  primary: string;
  secondary: string;
  tertiary: string;
};

type ElevenLabsVoice = {
  description?: string;
  labels?: Record<string, string>;
  name?: string;
  verified_languages?: Array<{
    accent?: string;
    language?: string;
    locale?: string;
  }>;
  voice_id?: string;
};

type DialogueInput = {
  text: string;
  voice_id: string;
};

export type ElevenLabsProbeResult = {
  dialogue: {
    ok: boolean;
    outputPath?: string;
    responseBody?: string;
    status: number;
  };
  reportPath: string;
  voiceLookup: {
    availableVoiceCount?: number;
    ok: boolean;
    responseBody?: string;
    selectedVoices?: BriefingVoices;
    status: number;
  };
};

type VoiceRole = 'primary' | 'secondary';

function scoreVoice(voice: ElevenLabsVoice, role: VoiceRole) {
  const name = voice.name?.toLowerCase() ?? '';
  const description = voice.description?.toLowerCase() ?? '';
  const accent = voice.labels?.accent?.toLowerCase() ?? '';
  const gender = voice.labels?.gender?.toLowerCase() ?? '';
  const useCase = voice.labels?.use_case?.toLowerCase() ?? '';
  const age = voice.labels?.age?.toLowerCase() ?? '';
  const allText = `${name} ${description} ${accent} ${useCase}`;
  const locales = (voice.verified_languages ?? []).map((language) => ({
    accent: language.accent?.toLowerCase() ?? '',
    language: language.language?.toLowerCase() ?? '',
    locale: language.locale?.toLowerCase() ?? '',
  }));

  let score = 0;

  // English language support — baseline requirement
  if (
    description.includes('english') ||
    locales.some(
      (language) =>
        language.language === 'en' || language.locale.startsWith('en-'),
    )
  ) {
    score += 8;
  }

  // Role-specific: primary = male English, secondary = female Irish
  if (role === 'primary') {
    if (gender === 'male') score += 12;
    if (gender === 'female') score -= 10;
    if (
      accent.includes('british') ||
      accent.includes('english') ||
      locales.some((l) => l.accent.includes('british') || l.locale === 'en-gb')
    ) {
      score += 10;
    }
  } else {
    if (gender === 'female') score += 12;
    if (gender === 'male') score -= 10;
    if (
      accent.includes('irish') ||
      locales.some((l) => l.accent.includes('irish') || l.locale === 'en-ie')
    ) {
      score += 10;
    }
  }

  // Prefer conversational, warm, natural voices
  const conversationalKeywords = ['conversational', 'warm', 'friendly', 'natural', 'casual', 'relaxed', 'engaging', 'pleasant'];
  for (const keyword of conversationalKeywords) {
    if (allText.includes(keyword)) {
      score += 4;
    }
  }

  // Good use cases for a morning show
  if (
    useCase.includes('conversational') ||
    useCase.includes('podcast') ||
    useCase.includes('narration') ||
    useCase.includes('news')
  ) {
    score += 6;
  }

  // Prefer younger/middle-aged voices
  if (age.includes('young') || age.includes('middle')) {
    score += 3;
  }

  // Penalize overly formal/stiff descriptors
  const stuffyKeywords = ['formal', 'authoritative', 'commanding', 'deep', 'gravelly'];
  for (const keyword of stuffyKeywords) {
    if (allText.includes(keyword)) {
      score -= 3;
    }
  }

  return score;
}

function dedupeVoiceIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function rankVoicesForRole(voices: ElevenLabsVoice[], role: VoiceRole) {
  return voices
    .filter(
      (voice): voice is ElevenLabsVoice & { voice_id: string } =>
        typeof voice.voice_id === 'string',
    )
    .sort((left, right) => scoreVoice(right, role) - scoreVoice(left, role));
}

export async function selectBriefingVoices(options: {
  apiKey: string;
  fetchImplementation?: typeof fetch;
  overrides?: Partial<BriefingVoices>;
}): Promise<BriefingVoices> {
  const overrideIds = dedupeVoiceIds(
    [
      options.overrides?.primary,
      options.overrides?.secondary,
      options.overrides?.tertiary,
    ].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    ),
  );

  if (overrideIds.length > 0) {
    return {
      primary: options.overrides?.primary ?? overrideIds[0],
      secondary:
        options.overrides?.secondary ??
        options.overrides?.primary ??
        overrideIds[0],
      tertiary:
        options.overrides?.tertiary ??
        options.overrides?.secondary ??
        options.overrides?.primary ??
        overrideIds[0],
    };
  }

  const fetchImplementation = options.fetchImplementation ?? fetch;
  const response = await fetchImplementation(
    'https://api.elevenlabs.io/v2/voices?voice_type=default&page_size=100',
    {
      headers: {
        'xi-api-key': options.apiKey,
      },
      method: 'GET',
    },
  );

  if (!response.ok) {
    throw new Error(
      `ElevenLabs voice lookup failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as { voices?: ElevenLabsVoice[] };
  const allVoices = (payload.voices ?? []).filter(
    (v): v is ElevenLabsVoice & { voice_id: string } =>
      typeof v.voice_id === 'string',
  );

  const primaryRanked = rankVoicesForRole(allVoices, 'primary');
  const primaryVoice = primaryRanked[0];

  if (!primaryVoice?.voice_id) {
    throw new Error(
      'No ElevenLabs voices were available for briefing synthesis.',
    );
  }

  // Pick the best secondary voice that isn't the same as primary
  const secondaryRanked = rankVoicesForRole(allVoices, 'secondary');
  const secondaryVoice =
    secondaryRanked.find((v) => v.voice_id !== primaryVoice.voice_id) ??
    secondaryRanked[0] ??
    primaryVoice;

  return {
    primary: primaryVoice.voice_id,
    secondary: secondaryVoice.voice_id,
    tertiary: secondaryVoice.voice_id,
  };
}

function getVoiceIdForSegment(
  voices: BriefingVoices,
  segment: BriefingSegment,
) {
  if (segment.voiceSlot === 'secondary') {
    return voices.secondary;
  }

  if (segment.voiceSlot === 'tertiary') {
    return voices.tertiary;
  }

  return voices.primary;
}

function getDefaultProbeOutputPath(now = new Date()) {
  const isoDate = now.toISOString().slice(0, 10);

  return join(
    process.cwd(),
    '../../artifacts/briefings',
    isoDate,
    'elevenlabs-probe.mp3',
  );
}

function buildDialogueInputs(
  briefing: MorningBriefing,
  voices: BriefingVoices,
): DialogueInput[] {
  // Merge consecutive segments from the same voice into single inputs
  // to stay within ElevenLabs dialogue API limits
  const merged: DialogueInput[] = [];

  for (const segment of briefing.segments) {
    const voiceId = getVoiceIdForSegment(voices, segment);
    const last = merged[merged.length - 1];

    if (last && last.voice_id === voiceId) {
      last.text += `\n\n${segment.performanceText}`;
    } else {
      merged.push({
        text: segment.performanceText,
        voice_id: voiceId,
      });
    }
  }

  return merged;
}

export async function synthesizeBriefingAudio(options: {
  apiKey: string;
  briefing: MorningBriefing;
  fetchImplementation?: typeof fetch;
  outputPath: string;
  voices: BriefingVoices;
}) {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const outputDir = dirname(options.outputPath);
  const transcriptPath = join(outputDir, 'morning-briefing.txt');
  const dialoguePlanPath = join(outputDir, 'morning-briefing.dialogue.json');
  const dialogueInputs = buildDialogueInputs(options.briefing, options.voices);

  await mkdir(outputDir, { recursive: true });
  await writeFile(transcriptPath, options.briefing.transcript, 'utf8');
  await writeFile(
    dialoguePlanPath,
    JSON.stringify(
      {
        inputs: options.briefing.segments.map((segment, index) => ({
          performanceText: segment.performanceText,
          roleLabel: segment.roleLabel,
          speaker: segment.speaker,
          text: segment.text,
          voiceHint: segment.voiceHint,
          voiceId: dialogueInputs[index]?.voice_id,
          voiceSlot: segment.voiceSlot,
        })),
        modelId: 'eleven_v3',
      },
      null,
      2,
    ),
    'utf8',
  );

  // Batch inputs to stay under ElevenLabs' 5000 character limit per request
  const MAX_CHARS = 4800;
  const batches: DialogueInput[][] = [];
  let currentBatch: DialogueInput[] = [];
  let currentChars = 0;

  for (const input of dialogueInputs) {
    const inputChars = input.text.length;
    if (currentBatch.length > 0 && currentChars + inputChars > MAX_CHARS) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }
    currentBatch.push(input);
    currentChars += inputChars;
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  const audioChunks: Uint8Array[] = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const response = await fetchImplementation(
      'https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128',
      {
        body: JSON.stringify({
          apply_text_normalization: 'auto',
          inputs: batch,
          language_code: 'en',
          model_id: 'eleven_v3',
        }),
        headers: {
          'content-type': 'application/json',
          'xi-api-key': options.apiKey,
        },
        method: 'POST',
      },
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(no body)');
      throw new Error(
        `ElevenLabs dialogue synthesis failed on batch ${i + 1}/${batches.length} with status ${response.status}: ${errorBody.slice(0, 500)}. Dialogue plan saved to ${dialoguePlanPath}.`,
      );
    }

    audioChunks.push(new Uint8Array(await response.arrayBuffer()));
  }

  // Concatenate MP3 chunks (MP3 frames are independently decodable)
  const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of audioChunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  await writeFile(options.outputPath, combined);

  return {
    dialoguePlanPath,
    outputPath: options.outputPath,
    transcriptPath,
  };
}

export async function probeElevenLabs(options: {
  apiKey: string;
  fetchImplementation?: typeof fetch;
  outputPath?: string;
}): Promise<ElevenLabsProbeResult> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const outputPath = options.outputPath ?? getDefaultProbeOutputPath();
  const outputDir = dirname(outputPath);
  const reportPath = join(outputDir, 'elevenlabs-probe.json');

  await mkdir(outputDir, { recursive: true });

  const voicesResponse = await fetchImplementation(
    'https://api.elevenlabs.io/v2/voices?voice_type=default&page_size=100',
    {
      headers: {
        'xi-api-key': options.apiKey,
      },
      method: 'GET',
    },
  );

  if (!voicesResponse.ok) {
    const responseBody = await voicesResponse.text();
    const result: ElevenLabsProbeResult = {
      dialogue: {
        ok: false,
        status: 0,
      },
      reportPath,
      voiceLookup: {
        ok: false,
        responseBody,
        status: voicesResponse.status,
      },
    };

    await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf8');

    return result;
  }

  const payload = (await voicesResponse.json()) as {
    voices?: ElevenLabsVoice[];
  };
  const voices = rankVoicesForRole(payload.voices ?? [], 'primary');
  const [first, second] = voices;

  if (!first?.voice_id) {
    const result: ElevenLabsProbeResult = {
      dialogue: {
        ok: false,
        status: 0,
      },
      reportPath,
      voiceLookup: {
        availableVoiceCount: 0,
        ok: false,
        responseBody: 'No voice IDs were available for the probe.',
        status: 200,
      },
    };

    await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf8');

    return result;
  }

  const selectedVoices: BriefingVoices = {
    primary: first.voice_id,
    secondary: second?.voice_id ?? first.voice_id,
    tertiary: second?.voice_id ?? first.voice_id,
  };
  const dialogueResponse = await fetchImplementation(
    'https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128',
    {
      body: JSON.stringify({
        apply_text_normalization: 'auto',
        inputs: [
          {
            text: '[calm] This is a short probe for the lead anchor voice.',
            voice_id: selectedVoices.primary,
          },
          {
            text: '[measured] This is a short probe for the second reader voice.',
            voice_id: selectedVoices.secondary,
          },
        ],
        language_code: 'en',
        model_id: 'eleven_v3',
      }),
      headers: {
        'content-type': 'application/json',
        'xi-api-key': options.apiKey,
      },
      method: 'POST',
    },
  );

  const result: ElevenLabsProbeResult = {
    dialogue: {
      ok: dialogueResponse.ok,
      outputPath: dialogueResponse.ok ? outputPath : undefined,
      responseBody: dialogueResponse.ok
        ? undefined
        : await dialogueResponse.text(),
      status: dialogueResponse.status,
    },
    reportPath,
    voiceLookup: {
      availableVoiceCount: voices.length,
      ok: true,
      selectedVoices,
      status: voicesResponse.status,
    },
  };

  if (dialogueResponse.ok) {
    const bytes = new Uint8Array(await dialogueResponse.arrayBuffer());
    await writeFile(outputPath, bytes);
  }

  await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf8');

  return result;
}
