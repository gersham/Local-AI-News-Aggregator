import { writeActivityLog } from '@news-aggregator/core';
import { NextResponse } from 'next/server';
import { runPodcastGenerationCommand } from '../../../../lib/podcast-store';

let generationInProgress = false;

export async function POST() {
  if (generationInProgress) {
    return NextResponse.json(
      { error: 'A podcast generation is already in progress.' },
      { status: 409 },
    );
  }

  generationInProgress = true;

  writeActivityLog({
    severity: 'info',
    source: 'podcast',
    message: 'Starting podcast generation.',
  }).catch(() => {});

  // Fire and forget — run in background, log outcome
  runPodcastGenerationCommand({})
    .then(async (result) => {
      if (result.code !== 0) {
        await writeActivityLog({
          severity: 'error',
          source: 'podcast',
          message: `Podcast generation failed (exit code ${result.code}).`,
          metadata: {
            exitCode: result.code,
            stderr: result.stderr.slice(0, 4000),
            stdout: result.stdout.slice(0, 4000),
          },
        });
      } else {
        await writeActivityLog({
          severity: 'info',
          source: 'podcast',
          message: 'Podcast generation process completed successfully.',
        });
      }
    })
    .catch(async (error) => {
      await writeActivityLog({
        severity: 'error',
        source: 'podcast',
        message: `Podcast generation crashed: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          stack: error instanceof Error ? error.stack : undefined,
        },
      }).catch(() => {});
    })
    .finally(() => {
      generationInProgress = false;
    });

  return NextResponse.json({ ok: true, status: 'started' });
}

export async function GET() {
  return NextResponse.json({ generating: generationInProgress });
}
