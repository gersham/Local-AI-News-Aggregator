import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  probeElevenLabs,
  selectBriefingVoices,
  synthesizeBriefingAudio,
} from './elevenlabs';

describe('selectBriefingVoices', () => {
  it('chooses British and Irish leaning voices when no overrides are configured', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          voices: [
            {
              name: 'London Anchor',
              labels: { accent: 'British', gender: 'female' },
              voice_id: 'voice_primary',
            },
            {
              name: 'Dublin Correspondent',
              labels: { accent: 'Irish', gender: 'male' },
              voice_id: 'voice_secondary',
            },
            {
              name: 'Narrator',
              labels: { accent: 'American', gender: 'female' },
              voice_id: 'voice_tertiary',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const voices = await selectBriefingVoices({
      apiKey: 'elevenlabs-test',
      fetchImplementation: fetchMock,
    });

    expect(voices).toEqual({
      primary: 'voice_primary',
      secondary: 'voice_secondary',
      tertiary: 'voice_tertiary',
    });
  });
});

describe('synthesizeBriefingAudio', () => {
  it('writes a dialogue plan and synthesizes a single mp3 with the dialogue API', async () => {
    const outputDir = join(tmpdir(), `briefing-audio-${Date.now()}`);
    const outputPath = join(outputDir, 'briefing.mp3');
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
        }),
    );
    const result = await synthesizeBriefingAudio({
      apiKey: 'elevenlabs-test',
      briefing: {
        segments: [
          {
            performanceText: '[calm] Good morning.',
            roleLabel: 'Lead Anchor',
            speaker: 'anchor',
            text: 'Good morning.',
            voiceHint: 'British lead, steady public-radio delivery',
            voiceSlot: 'primary',
          },
          {
            performanceText:
              '[measured] The weather in Lantzville is overcast.',
            roleLabel: 'Weather Reader',
            speaker: 'weather',
            text: 'The weather in Lantzville is overcast.',
            voiceHint: 'British or Irish continuity voice, calm and precise',
            voiceSlot: 'secondary',
          },
        ],
        transcript: `[Lead Anchor | primary]\nvoice: British lead, steady public-radio delivery\n[calm] Good morning.\n\n[Weather Reader | secondary]\nvoice: British or Irish continuity voice, calm and precise\n[measured] The weather in Lantzville is overcast.`,
      },
      fetchImplementation: fetchMock,
      outputPath,
      voices: {
        primary: 'voice_primary',
        secondary: 'voice_secondary',
        tertiary: 'voice_tertiary',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128',
      expect.objectContaining({
        body: expect.stringContaining('"voice_id":"voice_primary"'),
        method: 'POST',
      }),
    );
    expect(result.outputPath).toBe(outputPath);
    expect(result.dialoguePlanPath).toContain('morning-briefing.dialogue.json');
    expect(existsSync(result.transcriptPath)).toBe(true);
    expect(existsSync(result.outputPath)).toBe(true);

    rmSync(outputDir, { recursive: true, force: true });
  });
});

describe('probeElevenLabs', () => {
  it('checks voice lookup and synthesizes a small dialogue probe clip', async () => {
    const outputDir = join(tmpdir(), `elevenlabs-probe-${Date.now()}`);
    const outputPath = join(outputDir, 'probe.mp3');
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            voices: [
              {
                name: 'London Anchor',
                labels: { accent: 'British' },
                voice_id: 'voice_primary',
              },
              {
                name: 'Dublin Correspondent',
                labels: { accent: 'Irish' },
                voice_id: 'voice_secondary',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
        }),
      );

    const result = await probeElevenLabs({
      apiKey: 'elevenlabs-test',
      fetchImplementation: fetchMock,
      outputPath,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.voiceLookup.status).toBe(200);
    expect(result.voiceLookup.availableVoiceCount).toBe(2);
    expect(result.voiceLookup.selectedVoices).toEqual({
      primary: 'voice_primary',
      secondary: 'voice_secondary',
      tertiary: 'voice_secondary',
    });
    expect(result.dialogue.status).toBe(200);
    expect(result.dialogue.outputPath).toBe(outputPath);
    expect(existsSync(outputPath)).toBe(true);
    expect(existsSync(result.reportPath)).toBe(true);

    rmSync(outputDir, { force: true, recursive: true });
  });
});
