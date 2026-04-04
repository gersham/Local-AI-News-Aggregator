import { NextResponse } from 'next/server';
import {
  getMongoPersistenceSetupMessage,
  isMongoPersistenceConfigurationError,
} from '../../../../../lib/persistence-error';
import {
  loadPodcastRuns,
  readPodcastAudioFile,
} from '../../../../../lib/podcast-store';

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      runId: string;
    }>;
  },
) {
  try {
    const { runId } = await context.params;
    const state = await loadPodcastRuns({
      limit: 100,
    });
    const run = state.runs.find((entry) => entry.runId === runId);

    if (!run) {
      return NextResponse.json(
        {
          error: `Podcast run "${runId}" was not found.`,
        },
        { status: 404 },
      );
    }

    const audio = await readPodcastAudioFile(run);

    return new NextResponse(audio, {
      headers: {
        'content-type': 'audio/mpeg',
      },
      status: 200,
    });
  } catch (error) {
    if (isMongoPersistenceConfigurationError(error)) {
      return NextResponse.json(
        {
          error: getMongoPersistenceSetupMessage(),
        },
        { status: 503 },
      );
    }

    if (error instanceof Error && error.message.includes('no audio path')) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 404 },
      );
    }

    throw error;
  }
}
