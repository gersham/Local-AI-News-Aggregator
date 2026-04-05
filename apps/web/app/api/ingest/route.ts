import { writeActivityLog } from '@news-aggregator/core';
import { NextResponse } from 'next/server';
import { runWorkerCommand } from '../../../lib/worker-command';

export async function POST() {
  try {
    await writeActivityLog({
      severity: 'info',
      source: 'ingest',
      message: 'Starting ingestion run.',
    });

    const result = await runWorkerCommand('ingest:run');

    if (result.code !== 0) {
      await writeActivityLog({
        severity: 'error',
        source: 'ingest',
        message: 'Ingestion failed.',
        metadata: { output: result.output.slice(0, 2000) },
      });

      return NextResponse.json(
        { error: 'Ingestion failed.', output: result.output },
        { status: 500 },
      );
    }

    await writeActivityLog({
      severity: 'info',
      source: 'ingest',
      message: 'Ingestion completed successfully.',
    });

    return NextResponse.json({ ok: true, output: result.output });
  } catch (error) {
    await writeActivityLog({
      severity: 'error',
      source: 'ingest',
      message:
        error instanceof Error
          ? error.message
          : 'Unexpected ingestion failure.',
    }).catch(() => {});

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected ingestion failure.',
      },
      { status: 500 },
    );
  }
}
