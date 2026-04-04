import { NextResponse } from 'next/server';
import { loadFeedSnapshot } from '../../../lib/feed-store';

function createPayload(state: Awaited<ReturnType<typeof loadFeedSnapshot>>) {
  return {
    meta: {
      examplePath: state.examplePath,
      storagePath: state.storagePath,
      usingExampleFallback: state.usingExampleFallback,
    },
    snapshot: state.snapshot,
  };
}

export async function GET() {
  const state = await loadFeedSnapshot();

  return NextResponse.json(createPayload(state));
}
