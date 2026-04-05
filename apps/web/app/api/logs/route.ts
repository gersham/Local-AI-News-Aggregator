import { NextResponse } from 'next/server';
import { loadActivityLogs } from '../../../lib/activity-log-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const severity = url.searchParams.get('severity') ?? undefined;
    const since = url.searchParams.get('since') ?? undefined;
    const source = url.searchParams.get('source') ?? undefined;
    const limit = Number(url.searchParams.get('limit') ?? '200');

    const state = await loadActivityLogs({ severity, since, source, limit });

    // When polling with a cursor and there are no new entries, return 304
    if (since && state.entries.length === 0) {
      return new NextResponse(null, { status: 304 });
    }

    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to load logs.',
      },
      { status: 500 },
    );
  }
}
