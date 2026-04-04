import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { NextResponse } from 'next/server';

const projectRoot = resolve(process.cwd(), '../..');

export async function POST() {
  try {
    const result = await new Promise<{ code: number; output: string }>(
      (resolvePromise, reject) => {
        const chunks: string[] = [];
        const child = spawn(
          'pnpm',
          ['--filter', '@news-aggregator/worker', 'start', 'briefing:audio'],
          {
            cwd: projectRoot,
            env: { ...process.env },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );

        child.stdout.on('data', (data: Buffer) => {
          chunks.push(data.toString());
        });

        child.stderr.on('data', (data: Buffer) => {
          chunks.push(data.toString());
        });

        child.on('error', reject);

        child.on('close', (code) => {
          resolvePromise({ code: code ?? 1, output: chunks.join('') });
        });
      },
    );

    if (result.code !== 0) {
      return NextResponse.json(
        { error: 'Podcast generation failed.', output: result.output },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, output: result.output });
  } catch (error) {
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
