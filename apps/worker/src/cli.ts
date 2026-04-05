import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { savePodcastRunToMongo, writeActivityLog } from '@news-aggregator/core';
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
import { runIngestCommand } from './ingest';
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

async function generateBriefingAudioRun(input: {
  buildBriefing: (input: {
    date: string;
    feedSnapshot: Awaited<ReturnType<typeof loadWorkerFeedSnapshot>>;
    weather: Awaited<ReturnType<typeof fetchDailyWeatherSummary>>;
  }) => MorningBriefing | Promise<MorningBriefing>;
  fetchWeather: typeof fetchDailyWeatherSummary;
  loadFeedSnapshot: typeof loadWorkerFeedSnapshot;
  persistPodcastRun?: typeof savePodcastRunToMongo;
  runIngestCommand?: typeof runIngestCommand;
  selectVoices: typeof selectBriefingVoices;
  synthesize: typeof synthesizeBriefingAudio;
  writeLine: (line: string) => void;
}) {
  const logError = (step: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    writeActivityLog({
      severity: 'error',
      source: 'podcast',
      message: `Failed at "${step}": ${message}`,
      metadata: { step, stack },
    }).catch(() => {});
  };

  if (input.runIngestCommand) {
    await writeActivityLog({ severity: 'info', source: 'podcast', message: 'Starting news ingestion...' }).catch(() => {});
    try {
      await input.runIngestCommand();
    } catch (error) {
      logError('ingestion', error);
      throw error;
    }
  }

  await writeActivityLog({ severity: 'info', source: 'podcast', message: 'Loading feed snapshot and weather data...' }).catch(() => {});
  let feedSnapshot: Awaited<ReturnType<typeof input.loadFeedSnapshot>>;
  let weather: Awaited<ReturnType<typeof input.fetchWeather>>;
  try {
    [feedSnapshot, weather] = await Promise.all([
      input.loadFeedSnapshot(),
      input.fetchWeather({
        locationQuery: process.env.HOME_LOCATION_QUERY,
      }),
    ]);
  } catch (error) {
    logError('load feed/weather', error);
    throw error;
  }

  await writeActivityLog({ severity: 'info', source: 'podcast', message: `Building briefing script from ${feedSnapshot.entries.length} stories...` }).catch(() => {});
  let briefing: MorningBriefing;
  try {
    briefing = await input.buildBriefing({
      date: feedSnapshot.generatedAt,
      feedSnapshot,
      weather,
    });
  } catch (error) {
    logError('build briefing script', error);
    throw error;
  }

  input.writeLine(briefing.transcript);

  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    const error = new Error(
      'ELEVENLABS_API_KEY is required for briefing generation. Ensure the repo-root .env is loaded.',
    );
    logError('check API key', error);
    throw error;
  }

  const outputPath = getDefaultOutputPath();
  await writeActivityLog({ severity: 'info', source: 'podcast', message: 'Selecting ElevenLabs voices...' }).catch(() => {});
  let voices: Awaited<ReturnType<typeof input.selectVoices>>;
  try {
    voices = await input.selectVoices({
      apiKey,
      overrides: {
        primary: process.env.ELEVENLABS_PRIMARY_VOICE_ID,
        secondary: process.env.ELEVENLABS_SECONDARY_VOICE_ID,
        tertiary: process.env.ELEVENLABS_TERTIARY_VOICE_ID,
      },
    });
  } catch (error) {
    logError('voice selection', error);
    throw error;
  }

  await writeActivityLog({ severity: 'info', source: 'podcast', message: `Synthesizing audio (${briefing.segments.length} segments)...` }).catch(() => {});
  let audioResult: Awaited<ReturnType<typeof input.synthesize>>;
  try {
    audioResult = await input.synthesize({
      apiKey,
      briefing,
      outputPath,
      voices,
    });
  } catch (error) {
    logError('audio synthesis', error);
    throw error;
  }

  const generatedAt = new Date().toISOString();
  const persistPodcastRun = input.persistPodcastRun ?? savePodcastRunToMongo;
  let savedRun: Awaited<ReturnType<typeof persistPodcastRun>>;
  try {
    savedRun = await persistPodcastRun({
      audioPath: audioResult.outputPath,
      date: generatedAt.slice(0, 10),
      generatedAt,
      transcript: briefing.transcript,
      transcriptPath: audioResult.transcriptPath,
    });
  } catch (error) {
    logError('save podcast run', error);
    throw error;
  }

  await writeActivityLog({ severity: 'info', source: 'podcast', message: 'Podcast generation complete.', metadata: { runId: savedRun.run.runId, outputPath: audioResult.outputPath } }).catch(() => {});
  input.writeLine(`MP3 written to ${audioResult.outputPath}`);

  return {
    audioResult,
    briefing,
    podcastRun: savedRun.run,
  };
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
    runIngestCommand?: typeof runIngestCommand;
    loadFeedSnapshot?: typeof loadWorkerFeedSnapshot;
    persistPodcastRun?: typeof savePodcastRunToMongo;
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

  if (command === 'ingest:run') {
    const ingest = dependencies.runIngestCommand ?? runIngestCommand;
    const summary = await ingest();

    writeLine(JSON.stringify(summary, null, 2));

    return {
      audioServer: undefined,
      delivery: undefined,
      probe: undefined,
      sonosPlayback: undefined,
      sonosProbe: undefined,
      transcript: '',
    };
  }

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

    const selectVoices =
      dependencies.selectBriefingVoices ?? selectBriefingVoices;
    const synthesize =
      dependencies.synthesizeBriefingAudio ?? synthesizeBriefingAudio;
    const generation = await generateBriefingAudioRun({
      buildBriefing,
      fetchWeather,
      loadFeedSnapshot,
      persistPodcastRun: dependencies.persistPodcastRun,
      selectVoices,
      synthesize,
      writeLine,
    });
    const playbackUrl = getHostedBriefingUrl(generation.audioResult.outputPath);
    const playBriefing =
      dependencies.playBriefingOnTargetRoom ?? playBriefingOnTargetRoom;
    const sonosPlayback = await playBriefing({
      playbackUrl,
      targetHost,
      targetRoom,
    });
    const delivery = {
      outputPath: generation.audioResult.outputPath,
      playbackUrl,
      sonosPlayback,
      transcriptPath: generation.audioResult.transcriptPath,
    };

    writeLine(
      JSON.stringify(
        {
          outputPath: generation.audioResult.outputPath,
          podcastRunId: generation.podcastRun.runId,
          playbackUrl,
          roomName: sonosPlayback.roomName,
          sonosHost: sonosPlayback.host,
          transcriptPath: generation.audioResult.transcriptPath,
        },
        null,
        2,
      ),
    );

    return {
      audioServer: undefined,
      delivery,
      outputPath: generation.audioResult.outputPath,
      podcastRun: generation.podcastRun,
      probe: undefined,
      sonosPlayback,
      sonosProbe: undefined,
      transcript: generation.briefing.transcript,
      transcriptPath: generation.audioResult.transcriptPath,
    };
  }

  if (
    command === 'briefing:preview' ||
    command === 'briefing:audio' ||
    command === 'briefing:generate'
  ) {
    const [feedSnapshot, weather] = await Promise.all([
      loadFeedSnapshot(),
      fetchWeather({
        locationQuery: process.env.HOME_LOCATION_QUERY,
      }),
    ]);

    if (command === 'briefing:preview') {
      const briefing = await buildBriefing({
        date: (
          feedSnapshot as Awaited<ReturnType<typeof loadWorkerFeedSnapshot>>
        ).generatedAt,
        feedSnapshot: feedSnapshot as Awaited<
          ReturnType<typeof loadWorkerFeedSnapshot>
        >,
        weather: weather as Awaited<
          ReturnType<typeof fetchDailyWeatherSummary>
        >,
      });
      writeLine(briefing.transcript);

      return {
        audioServer: undefined,
        delivery: undefined,
        podcastRun: undefined,
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
    const generation = await generateBriefingAudioRun({
      buildBriefing,
      fetchWeather,
      loadFeedSnapshot,
      persistPodcastRun: dependencies.persistPodcastRun,
      selectVoices,
      synthesize,
      writeLine,
    });

    return {
      audioServer: undefined,
      delivery: undefined,
      outputPath: generation.audioResult.outputPath,
      podcastRun: generation.podcastRun,
      probe: undefined,
      sonosPlayback: undefined,
      sonosProbe: undefined,
      transcript: generation.briefing.transcript,
      transcriptPath: generation.audioResult.transcriptPath,
    };
  }

  writeLine(
    'Available commands: ingest:run, briefing:preview, briefing:audio, briefing:generate, briefing:deliver, elevenlabs:probe, audio:serve, sonos:probe, sonos:play-briefing',
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
    outputPath: undefined as string | undefined,
    podcastRun: undefined as
      | Awaited<ReturnType<typeof savePodcastRunToMongo>>['run']
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
