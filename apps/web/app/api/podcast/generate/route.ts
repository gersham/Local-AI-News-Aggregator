import { writeActivityLog } from '@news-aggregator/core';
import { NextResponse } from 'next/server';
import { runPodcastGenerationCommand } from '../../../../lib/podcast-store';

export async function POST() {
  try {
    await writeActivityLog({
      severity: 'info',
      source: 'podcast',
      message: 'Starting podcast generation.',
    });

    const result = await runPodcastGenerationCommand({});

    if (result.code !== 0) {
      await writeActivityLog({
        severity: 'error',
        source: 'podcast',
        message: 'Podcast generation failed.',
        metadata: { output: result.output.slice(0, 2000) },
      });

      return NextResponse.json(
        { error: 'Podcast generation failed.', output: result.output },
        { status: 500 },
      );
    }

    await writeActivityLog({
      severity: 'info',
      source: 'podcast',
      message: 'Podcast generated successfully.',
    });

    return NextResponse.json({ ok: true, output: result.output });
  } catch (error) {
    await writeActivityLog({
      severity: 'error',
      source: 'podcast',
      message:
        error instanceof Error
          ? error.message
          : 'Unexpected podcast generation failure.',
    }).catch(() => {});

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected podcast generation failure.',
      },
      { status: 500 },
    );
  }
}
