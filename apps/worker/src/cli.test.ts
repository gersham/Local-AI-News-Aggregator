import { describe, expect, it, vi } from 'vitest';
import { runWorkerCli } from './cli';

describe('runWorkerCli', () => {
  it('prints the production script in preview mode', async () => {
    const writeLine = vi.fn();

    const result = await runWorkerCli(['briefing:preview'], {
      buildMorningBriefing: async () => ({
        segments: [
          {
            performanceText: '[calm] Good morning.',
            roleLabel: 'Lead Anchor',
            speaker: 'anchor',
            text: 'Good morning.',
            voiceHint: 'British lead, steady public-radio delivery',
            voiceSlot: 'primary',
          },
        ],
        transcript:
          '[Lead Anchor | primary]\nvoice: British lead, steady public-radio delivery\n[calm] Good morning.',
      }),
      fetchDailyWeatherSummary: async () => ({
        conditionSummary: 'Overcast',
        locationName: 'Lantzville',
        precipitationProbabilityMax: 45,
        temperatureHighC: 14.2,
        timezone: 'America/Vancouver',
      }),
      loadFeedSnapshot: async () => ({
        entries: [],
        generatedAt: '2026-04-04T15:00:00.000Z',
      }),
      writeLine,
    });

    expect(result.transcript).toContain('Good morning');
    expect(result.transcript).toContain('voice: British lead');
    expect(writeLine).toHaveBeenCalledWith(
      '[Lead Anchor | primary]\nvoice: British lead, steady public-radio delivery\n[calm] Good morning.',
    );
  });

  it('prints the transcript and generates audio in mp3 mode', async () => {
    const previousApiKey = process.env.ELEVENLABS_API_KEY;
    const writeLine = vi.fn();

    process.env.ELEVENLABS_API_KEY = 'elevenlabs-test';

    const result = await runWorkerCli(['briefing:audio'], {
      buildMorningBriefing: async () => ({
        segments: [
          {
            performanceText: '[calm] Good morning.',
            roleLabel: 'Lead Anchor',
            speaker: 'anchor',
            text: 'Good morning.',
            voiceHint: 'British lead, steady public-radio delivery',
            voiceSlot: 'primary',
          },
        ],
        transcript:
          '[Lead Anchor | primary]\nvoice: British lead, steady public-radio delivery\n[calm] Good morning.',
      }),
      fetchDailyWeatherSummary: async () => ({
        conditionSummary: 'Overcast',
        locationName: 'Lantzville',
        precipitationProbabilityMax: 45,
        temperatureHighC: 14.2,
        timezone: 'America/Vancouver',
      }),
      loadFeedSnapshot: async () => ({
        entries: [],
        generatedAt: '2026-04-04T15:00:00.000Z',
      }),
      persistPodcastRun: async (input) => ({
        run: {
          audioPath: input.audioPath,
          date: input.date,
          generatedAt: input.generatedAt,
          runId: 'run_123',
          transcriptPath: input.transcriptPath,
        },
        storageTarget: 'mongodb:test/podcast_runs',
      }),
      selectBriefingVoices: async () => ({
        primary: 'voice_primary',
        secondary: 'voice_secondary',
        tertiary: 'voice_tertiary',
      }),
      synthesizeBriefingAudio: async () => ({
        dialoguePlanPath: '/tmp/briefing.dialogue.json',
        outputPath: '/tmp/briefing.mp3',
        transcriptPath: '/tmp/briefing.txt',
      }),
      writeLine,
    });

    expect(result.outputPath).toBe('/tmp/briefing.mp3');
    expect(writeLine).toHaveBeenCalledWith('MP3 written to /tmp/briefing.mp3');

    process.env.ELEVENLABS_API_KEY = previousApiKey;
  });

  it('prints an ElevenLabs probe summary', async () => {
    const previousApiKey = process.env.ELEVENLABS_API_KEY;
    const writeLine = vi.fn();

    process.env.ELEVENLABS_API_KEY = 'elevenlabs-test';

    const result = await runWorkerCli(['elevenlabs:probe'], {
      probeElevenLabs: async () => ({
        dialogue: {
          ok: true,
          outputPath: '/tmp/elevenlabs-probe.mp3',
          status: 200,
        },
        reportPath: '/tmp/elevenlabs-probe.json',
        voiceLookup: {
          availableVoiceCount: 3,
          ok: true,
          selectedVoices: {
            primary: 'voice_primary',
            secondary: 'voice_secondary',
            tertiary: 'voice_tertiary',
          },
          status: 200,
        },
      }),
      writeLine,
    });

    expect(result.probe?.dialogue.status).toBe(200);
    expect(writeLine).toHaveBeenCalledWith(
      JSON.stringify(
        {
          dialogue: {
            ok: true,
            outputPath: '/tmp/elevenlabs-probe.mp3',
            status: 200,
          },
          reportPath: '/tmp/elevenlabs-probe.json',
          voiceLookup: {
            availableVoiceCount: 3,
            ok: true,
            selectedVoices: {
              primary: 'voice_primary',
              secondary: 'voice_secondary',
              tertiary: 'voice_tertiary',
            },
            status: 200,
          },
        },
        null,
        2,
      ),
    );

    process.env.ELEVENLABS_API_KEY = previousApiKey;
  });

  it('prints a Sonos probe summary', async () => {
    const previousRoom = process.env.SONOS_TARGET_ROOM;
    const writeLine = vi.fn();

    process.env.SONOS_TARGET_ROOM = 'Bedroom Ceiling';

    const result = await runWorkerCli(['sonos:probe'], {
      probeSonosTargetRoom: async () => ({
        discoveredRooms: ['Bedroom Ceiling', 'Office'],
        selectedDeviceHost: '192.168.1.15',
        targetRoom: 'Bedroom Ceiling',
      }),
      writeLine,
    });

    expect(result.sonosProbe?.selectedDeviceHost).toBe('192.168.1.15');
    expect(writeLine).toHaveBeenCalledWith(
      JSON.stringify(
        {
          discoveredRooms: ['Bedroom Ceiling', 'Office'],
          selectedDeviceHost: '192.168.1.15',
          targetRoom: 'Bedroom Ceiling',
        },
        null,
        2,
      ),
    );

    process.env.SONOS_TARGET_ROOM = previousRoom;
  });

  it('prints the Sonos playback result for the latest briefing', async () => {
    const previousBaseUrl = process.env.AUDIO_HOST_BASE_URL;
    const previousRoom = process.env.SONOS_TARGET_ROOM;
    const writeLine = vi.fn();

    process.env.AUDIO_HOST_BASE_URL = 'http://arch.local:9999';
    process.env.SONOS_TARGET_ROOM = 'Bedroom Ceiling';

    const result = await runWorkerCli(['sonos:play-briefing'], {
      getLatestBriefingAudioPath: async () =>
        '/Users/gersham/Sources/personal/NewsAggregator/artifacts/briefings/2026-04-04/morning-briefing.mp3',
      playBriefingOnTargetRoom: async () => ({
        host: '192.168.1.15',
        playbackUrl:
          'http://arch.local:9999/briefings/2026-04-04/morning-briefing.mp3',
        roomName: 'Bedroom Ceiling',
      }),
      writeLine,
    });

    expect(result.sonosPlayback?.roomName).toBe('Bedroom Ceiling');
    expect(writeLine).toHaveBeenCalledWith(
      JSON.stringify(
        {
          host: '192.168.1.15',
          playbackUrl:
            'http://arch.local:9999/briefings/2026-04-04/morning-briefing.mp3',
          roomName: 'Bedroom Ceiling',
        },
        null,
        2,
      ),
    );

    process.env.AUDIO_HOST_BASE_URL = previousBaseUrl;
    process.env.SONOS_TARGET_ROOM = previousRoom;
  });

  it('prints the audio server startup summary', async () => {
    const previousBaseUrl = process.env.AUDIO_HOST_BASE_URL;
    const writeLine = vi.fn();

    process.env.AUDIO_HOST_BASE_URL = 'http://arch.local:9999';

    const result = await runWorkerCli(['audio:serve'], {
      startAudioArtifactServer: async () => ({
        close: async () => undefined,
        origin: 'http://0.0.0.0:9999',
      }),
      writeLine,
    });

    expect(result.audioServer?.origin).toBe('http://0.0.0.0:9999');
    expect(writeLine).toHaveBeenCalledWith(
      JSON.stringify(
        {
          advertisedBaseUrl: 'http://arch.local:9999',
          origin: 'http://0.0.0.0:9999',
        },
        null,
        2,
      ),
    );

    process.env.AUDIO_HOST_BASE_URL = previousBaseUrl;
  });

  it('generates the briefing audio and triggers Sonos playback in one shot', async () => {
    const previousApiKey = process.env.ELEVENLABS_API_KEY;
    const previousBaseUrl = process.env.AUDIO_HOST_BASE_URL;
    const previousRoom = process.env.SONOS_TARGET_ROOM;
    const previousHost = process.env.SONOS_TARGET_HOST;
    const writeLine = vi.fn();

    process.env.ELEVENLABS_API_KEY = 'elevenlabs-test';
    process.env.AUDIO_HOST_BASE_URL = 'http://arch.local:9999';
    process.env.SONOS_TARGET_ROOM = 'Bedroom Ceiling';
    process.env.SONOS_TARGET_HOST = '10.3.78.223';

    const result = await runWorkerCli(['briefing:deliver'], {
      buildMorningBriefing: async () => ({
        segments: [
          {
            performanceText: '[calm] Good morning.',
            roleLabel: 'Lead Anchor',
            speaker: 'anchor',
            text: 'Good morning.',
            voiceHint: 'British lead, steady public-radio delivery',
            voiceSlot: 'primary',
          },
        ],
        transcript:
          '[Lead Anchor | primary]\nvoice: British lead, steady public-radio delivery\n[calm] Good morning.',
      }),
      fetchDailyWeatherSummary: async () => ({
        conditionSummary: 'Overcast',
        locationName: 'Lantzville',
        precipitationProbabilityMax: 45,
        temperatureHighC: 14.2,
        timezone: 'America/Vancouver',
      }),
      loadFeedSnapshot: async () => ({
        entries: [],
        generatedAt: '2026-04-04T15:00:00.000Z',
      }),
      persistPodcastRun: async (input) => ({
        run: {
          audioPath: input.audioPath,
          date: input.date,
          generatedAt: input.generatedAt,
          runId: 'run_123',
          transcriptPath: input.transcriptPath,
        },
        storageTarget: 'mongodb:test/podcast_runs',
      }),
      playBriefingOnTargetRoom: async () => ({
        host: '10.3.78.223',
        playbackUrl:
          'http://arch.local:9999/briefings/2026-04-04/morning-briefing.mp3',
        roomName: 'Bedroom Ceiling',
      }),
      selectBriefingVoices: async () => ({
        primary: 'voice_primary',
        secondary: 'voice_secondary',
        tertiary: 'voice_tertiary',
      }),
      synthesizeBriefingAudio: async () => ({
        dialoguePlanPath: '/tmp/briefing.dialogue.json',
        outputPath:
          '/Users/gersham/Sources/personal/NewsAggregator/artifacts/briefings/2026-04-04/morning-briefing.mp3',
        transcriptPath: '/tmp/briefing.txt',
      }),
      writeLine,
    });

    expect(result.delivery?.sonosPlayback.host).toBe('10.3.78.223');
    expect(result.delivery?.outputPath).toContain('morning-briefing.mp3');
    expect(writeLine).toHaveBeenLastCalledWith(
      JSON.stringify(
        {
          outputPath:
            '/Users/gersham/Sources/personal/NewsAggregator/artifacts/briefings/2026-04-04/morning-briefing.mp3',
          podcastRunId: 'run_123',
          playbackUrl:
            'http://arch.local:9999/briefings/2026-04-04/morning-briefing.mp3',
          roomName: 'Bedroom Ceiling',
          sonosHost: '10.3.78.223',
          transcriptPath: '/tmp/briefing.txt',
        },
        null,
        2,
      ),
    );

    process.env.ELEVENLABS_API_KEY = previousApiKey;
    process.env.AUDIO_HOST_BASE_URL = previousBaseUrl;
    process.env.SONOS_TARGET_ROOM = previousRoom;
    process.env.SONOS_TARGET_HOST = previousHost;
  });
});
