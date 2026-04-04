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

function scoreVoice(voice: ElevenLabsVoice) {
  const name = voice.name?.toLowerCase() ?? '';
  const description = voice.description?.toLowerCase() ?? '';
  const accent = voice.labels?.accent?.toLowerCase() ?? '';
  const locales = (voice.verified_languages ?? []).map((language) => ({
    accent: language.accent?.toLowerCase() ?? '',
    language: language.language?.toLowerCase() ?? '',
    locale: language.locale?.toLowerCase() ?? '',
  }));

  let score = 0;

  if (
    accent.includes('british') ||
    locales.some(
      (language) =>
        language.accent.includes('british') || language.locale === 'en-gb',
    )
  ) {
    score += 12;
  }

  if (
    accent.includes('irish') ||
    locales.some(
      (language) =>
        language.accent.includes('irish') || language.locale === 'en-ie',
    )
  ) {
    score += 10;
  }

  if (
    description.includes('english') ||
    locales.some(
      (language) =>
        language.language === 'en' || language.locale.startsWith('en-'),
    )
  ) {
    score += 6;
  }

  if (
    name.includes('anchor') ||
    name.includes('correspondent') ||
    description.includes('news') ||
    description.includes('narrat')
  ) {
    score += 4;
  }

  return score;
}

function dedupeVoiceIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function rankVoices(voices: ElevenLabsVoice[]) {
  return voices
    .filter(
      (voice): voice is ElevenLabsVoice & { voice_id: string } =>
        typeof voice.voice_id === 'string',
    )
    .sort((left, right) => scoreVoice(right) - scoreVoice(left));
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
  const voices = rankVoices(payload.voices ?? []);
  const [first, second, third] = voices;

  if (!first?.voice_id) {
    throw new Error(
      'No ElevenLabs voices were available for briefing synthesis.',
    );
  }

  return {
    primary: first.voice_id,
    secondary: second?.voice_id ?? first.voice_id,
    tertiary: third?.voice_id ?? second?.voice_id ?? first.voice_id,
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
  return briefing.segments.map((segment) => ({
    text: segment.performanceText,
    voice_id: getVoiceIdForSegment(voices, segment),
  }));
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

  const response = await fetchImplementation(
    'https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128',
    {
      body: JSON.stringify({
        apply_text_normalization: 'auto',
        inputs: dialogueInputs,
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
    throw new Error(
      `ElevenLabs dialogue synthesis failed with status ${response.status}. Dialogue plan saved to ${dialoguePlanPath}.`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(options.outputPath, bytes);

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
  const voices = rankVoices(payload.voices ?? []);
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
