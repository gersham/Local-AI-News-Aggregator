import { NextResponse } from 'next/server';
import { loadFeedSnapshot } from '../../../lib/feed-store';
import {
  getMongoPersistenceSetupMessage,
  isMongoPersistenceConfigurationError,
} from '../../../lib/persistence-error';

function createPayload(state: Awaited<ReturnType<typeof loadFeedSnapshot>>) {
  return {
    meta: {
      examplePath: state.examplePath,
      storageTarget: state.storageTarget,
      usingExampleFallback: state.usingExampleFallback,
    },
    snapshot: state.snapshot,
  };
}

export async function GET() {
  try {
    const state = await loadFeedSnapshot();

    return NextResponse.json(createPayload(state));
  } catch (error) {
    if (isMongoPersistenceConfigurationError(error)) {
      return NextResponse.json(
        {
          error: getMongoPersistenceSetupMessage(),
        },
        { status: 503 },
      );
    }

    throw error;
  }
}
