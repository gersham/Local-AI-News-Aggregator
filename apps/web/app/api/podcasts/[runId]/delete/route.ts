import { writeActivityLog } from '@news-aggregator/core';
import { NextResponse } from 'next/server';
import { deletePodcastRun } from '../../../../../lib/podcast-store';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  try {
    await deletePodcastRun(runId);
    await writeActivityLog({
      severity: 'info',
      source: 'podcast',
      message: `Podcast ${runId} deleted.`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed.' },
      { status: 500 },
    );
  }
}
