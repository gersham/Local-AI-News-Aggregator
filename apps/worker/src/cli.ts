import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildHostedArtifactUrl, startAudioArtifactServer } from './audio-host';
import type { MorningBriefing } from './briefing';
import { buildMorningBriefing } from './briefing';
import {
  type ElevenLabsProbeResult,
  probeElevenLabs,
  selectBriefingVoices,
  synthesizeBriefingAudio,
} from './elevenlabs';
import { loadWorkerFeedSnapshot } from './feed-snapshot-store';
import { playBriefingOnTargetRoom, probeSonosTargetRoom } from './sonos';
import { fetchDailyWeatherSummary } from './weather';

function getDefaultOutputPath(now = new Date()) {
  const isoDate = now.toISOString().slice(0, 10);

  return resolve(
    process.cwd(),
    '../../artifacts/briefings',
    isoDate,
    'morning-briefing.mp3',
  );
}

function getArtifactsRootPath() {
  return resolve(process.cwd(), '../../artifacts');
}

async function getLatestBriefingAudioPath() {
  const outputPath = getDefaultOutputPath();

  await access(outputPath);

  return outputPath;
}

function getHostedBriefingUrl(outputPath: string) {
  const baseUrl = process.env.AUDIO_HOST_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      'AUDIO_HOST_BASE_URL is required for hosted briefing URLs. Ensure the repo-root .env is loaded.',
    );
  }

  return buildHostedArtifactUrl({
    artifactPath: outputPath,
    artifactsRoot: getArtifactsRootPath(),
    baseUrl,
  });
}

export async function runWorkerCli(
  argv: string[],
  dependencies: {
    getLatestBriefingAudioPath?: () => Promise<string>;
    buildMorningBriefing?: (input: {
      date: string;
      feedSnapshot: Awaited<ReturnType<typeof loadWorkerFeedSnapshot>>;
      weather: Awaited<ReturnType<typeof fetchDailyWeatherSummary>>;
    }) => MorningBriefing | Promise<MorningBriefing>;
    fetchDailyWeatherSummary?: typeof fetchDailyWeatherSummary;
    loadFeedSnapshot?: typeof loadWorkerFeedSnapshot;
    probeElevenLabs?: typeof probeElevenLabs;
    probeSonosTargetRoom?: typeof probeSonosTargetRoom;
    playBriefingOnTargetRoom?: typeof playBriefingOnTargetRoom;
    selectBriefingVoices?: typeof selectBriefingVoices;
    startAudioArtifactServer?: typeof startAudioArtifactServer;
    synthesizeBriefingAudio?: typeof synthesizeBriefingAudio;
    writeLine?: (line: string) => void;
  } = {},
) {
  const command = argv[0] ?? 'status';
  const loadFeedSnapshot =
    dependencies.loadFeedSnapshot ?? loadWorkerFeedSnapshot;
  const fetchWeather =
    dependencies.fetchDailyWeatherSummary ?? fetchDailyWeatherSummary;
  const buildBriefing =
    dependencies.buildMorningBriefing ?? buildMorningBriefing;
  const writeLine = dependencies.writeLine ?? console.log;

  if (command === 'elevenlabs:probe') {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      throw new Error(
        'ELEVENLABS_API_KEY is required for elevenlabs:probe. Ensure the repo-root .env is loaded.',
      );
    }

    const runProbe = dependencies.probeElevenLabs ?? probeElevenLabs;
    const probe = await runProbe({
      apiKey,
    });

    writeLine(JSON.stringify(probe, null, 2));

    return {
      audioServer: undefined,
      delivery: undefined,
      probe,
      sonosPlayback: undefined,
      sonosProbe: undefined,
      transcript: '',
    };
  }

  if (command === 'audio:serve') {
    const baseUrl = process.env.AUDIO_HOST_BASE_URL;

    if (!baseUrl) {
      throw new Error(
        'AUDIO_HOST_BASE_URL is required for audio:serve. Ensure the repo-root .env is loaded.',
      );
    }

    const parsedBaseUrl = new URL(baseUrl);
    const startServer =
      dependencies.startAudioArtifactServer ?? startAudioArtifactServer;
    const audioServer = await startServer({
      artifactsRoot: getArtifactsRootPath(),
      host: '0.0.0.0',
      port: Number.parseInt(parsedBaseUrl.port || '80', 10),
    });

    writeLine(
      JSON.stringify(
        {
          advertisedBaseUrl: baseUrl,
          origin: audioServer.origin,
        },
        null,
        2,
      ),
    );

    return {
      audioServer,
      delivery: undefined,
      probe: undefined,
      sonosPlayback: undefined,
      sonosProbe: undefined,
      transcript: '',
    };
  }

  if (command === 'sonos:probe') {
    const targetRoom = process.env.SONOS_TARGET_ROOM;
    const targetHost = process.env.SONOS_TARGET_HOST;

    if (!targetRoom) {
      throw new Error(
        'SONOS_TARGET_ROOM is required for sonos:probe. Ensure the repo-root .env is loaded.',
      );
    }

    const runProbe = dependencies.probeSonosTargetRoom ?? probeSonosTargetRoom;
    const sonosProbe = await runProbe({
      targetHost,
      targetRoom,
    });

    writeLine(JSON.stringify(sonosProbe, null, 2));

    return {
      audioServer: undefined,
      delivery: undefined,
      probe: undefined,
      sonosPlayback: undefined,
      sonosProbe,
      transcript: '',
    };
  }

  if (command === 'sonos:play-briefing') {
    const targetHost = process.env.SONOS_TARGET_HOST;
    const targetRoom = process.env.SONOS_TARGET_ROOM;
    const baseUrl = process.env.AUDIO_HOST_BASE_URL;

    if (!targetRoom) {
      throw new Error(
        'SONOS_TARGET_ROOM is required for sonos:play-briefing. Ensure the repo-root .env is loaded.',
      );
    }

    if (!baseUrl) {
      throw new Error(
        'AUDIO_HOST_BASE_URL is required for sonos:play-briefing. Ensure the repo-root .env is loaded.',
      );
    }

    const resolveBriefingAudioPath =
      dependencies.getLatestBriefingAudioPath ?? getLatestBriefingAudioPath;
    const artifactPath = await resolveBriefingAudioPath();
    const playbackUrl = buildHostedArtifactUrl({
      artifactPath,
      artifactsRoot: getArtifactsRootPath(),
      baseUrl,
    });
    const playBriefing =
      dependencies.playBriefingOnTargetRoom ?? playBriefingOnTargetRoom;
    const sonosPlayback = await playBriefing({
      playbackUrl,
      targetHost,
      targetRoom,
    });

    writeLine(JSON.stringify(sonosPlayback, null, 2));

    return {
      audioServer: undefined,
      delivery: undefined,
      probe: undefined,
      sonosPlayback,
      sonosProbe: undefined,
      transcript: '',
    };
  }

  if (command === 'briefing:deliver') {
    const targetHost = process.env.SONOS_TARGET_HOST;
    const targetRoom = process.env.SONOS_TARGET_ROOM;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!targetRoom) {
      throw new Error(
        'SONOS_TARGET_ROOM is required for briefing:deliver. Ensure the repo-root .env is loaded.',
      );
    }

    if (!apiKey) {
      throw new Error(
        'ELEVENLABS_API_KEY is required for briefing:deliver. Ensure the repo-root .env is loaded.',
      );
    }

    const [feedSnapshot, weather] = await Promise.all([
      loadFeedSnapshot(),
      fetchWeather({
        locationQuery: process.env.HOME_LOCATION_QUERY,
      }),
    ]);
    const briefing = await buildBriefing({
      date: feedSnapshot.generatedAt,
      feedSnapshot,
      weather,
    });
    const selectVoices =
      dependencies.selectBriefingVoices ?? selectBriefingVoices;
    const synthesize =
      dependencies.synthesizeBriefingAudio ?? synthesizeBriefingAudio;
    const voices = await selectVoices({
      apiKey,
      overrides: {
        primary: process.env.ELEVENLABS_PRIMARY_VOICE_ID,
        secondary: process.env.ELEVENLABS_SECONDARY_VOICE_ID,
        tertiary: process.env.ELEVENLABS_TERTIARY_VOICE_ID,
      },
    });
    const audioResult = await synthesize({
      apiKey,
      briefing,
      outputPath: getDefaultOutputPath(),
      voices,
    });
    const playbackUrl = getHostedBriefingUrl(audioResult.outputPath);
    const playBriefing =
      dependencies.playBriefingOnTargetRoom ?? playBriefingOnTargetRoom;
    const sonosPlayback = await playBriefing({
      playbackUrl,
      targetHost,
      targetRoom,
    });
    const delivery = {
      outputPath: audioResult.outputPath,
      playbackUrl,
      sonosPlayback,
      transcriptPath: audioResult.transcriptPath,
    };

    writeLine(
      JSON.stringify(
        {
          outputPath: audioResult.outputPath,
          playbackUrl,
          roomName: sonosPlayback.roomName,
          sonosHost: sonosPlayback.host,
          transcriptPath: audioResult.transcriptPath,
        },
        null,
        2,
      ),
    );

    return {
      audioServer: undefined,
      delivery,
      probe: undefined,
      sonosPlayback,
      sonosProbe: undefined,
      transcript: briefing.transcript,
      transcriptPath: audioResult.transcriptPath,
    };
  }

  if (command === 'briefing:preview' || command === 'briefing:audio') {
    const [feedSnapshot, weather] = await Promise.all([
      loadFeedSnapshot(),
      fetchWeather({
        locationQuery: process.env.HOME_LOCATION_QUERY,
      }),
    ]);
    const briefing = await buildBriefing({
      date: feedSnapshot.generatedAt,
      feedSnapshot,
      weather,
    });

    writeLine(briefing.transcript);

    if (command === 'briefing:preview') {
      return {
        audioServer: undefined,
        delivery: undefined,
        probe: undefined,
        sonosPlayback: undefined,
        sonosProbe: undefined,
        transcript: briefing.transcript,
      };
    }

    const selectVoices =
      dependencies.selectBriefingVoices ?? selectBriefingVoices;
    const synthesize =
      dependencies.synthesizeBriefingAudio ?? synthesizeBriefingAudio;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      throw new Error(
        'ELEVENLABS_API_KEY is required for briefing:audio. Ensure the repo-root .env is loaded.',
      );
    }

    const outputPath = getDefaultOutputPath();
    const voices = await selectVoices({
      apiKey,
      overrides: {
        primary: process.env.ELEVENLABS_PRIMARY_VOICE_ID,
        secondary: process.env.ELEVENLABS_SECONDARY_VOICE_ID,
        tertiary: process.env.ELEVENLABS_TERTIARY_VOICE_ID,
      },
    });
    const audioResult = await synthesize({
      apiKey,
      briefing,
      outputPath,
      voices,
    });

    writeLine(`MP3 written to ${audioResult.outputPath}`);

    return {
      audioServer: undefined,
      delivery: undefined,
      outputPath: audioResult.outputPath,
      probe: undefined,
      sonosPlayback: undefined,
      sonosProbe: undefined,
      transcript: briefing.transcript,
      transcriptPath: audioResult.transcriptPath,
    };
  }

  writeLine(
    'Available commands: briefing:preview, briefing:audio, briefing:deliver, elevenlabs:probe, audio:serve, sonos:probe, sonos:play-briefing',
  );

  return {
    audioServer: undefined as
      | Awaited<ReturnType<typeof startAudioArtifactServer>>
      | undefined,
    delivery: undefined as
      | {
          outputPath: string;
          playbackUrl: string;
          sonosPlayback: Awaited<ReturnType<typeof playBriefingOnTargetRoom>>;
          transcriptPath: string;
        }
      | undefined,
    probe: undefined as ElevenLabsProbeResult | undefined,
    sonosPlayback: undefined as
      | Awaited<ReturnType<typeof playBriefingOnTargetRoom>>
      | undefined,
    sonosProbe: undefined as
      | Awaited<ReturnType<typeof probeSonosTargetRoom>>
      | undefined,
    transcript: '',
  };
}
