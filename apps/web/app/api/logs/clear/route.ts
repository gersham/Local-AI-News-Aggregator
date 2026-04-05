import { NextResponse } from 'next/server';
import { clearActivityLogs } from '../../../../lib/activity-log-store';

export async function POST() {
  try {
    await clearActivityLogs();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to clear logs.',
      },
      { status: 500 },
    );
  }
}
