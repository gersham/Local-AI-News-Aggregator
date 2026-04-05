import { execFile } from 'node:child_process';
import { resolve } from 'node:path';

const DEFAULT_PROJECT_ROOT = resolve(process.cwd(), '../..');

export type WorkerCommandName = 'briefing:generate' | 'ingest:run';

export type WorkerCommandResult = {
  code: number;
  output: string;
  stderr: string;
  stdout: string;
};

export async function runWorkerCommand(
  command: WorkerCommandName,
  options: {
    projectRoot?: string;
  } = {},
): Promise<WorkerCommandResult> {
  const projectRoot = options.projectRoot ?? DEFAULT_PROJECT_ROOT;

  return new Promise((resolvePromise, reject) => {
    execFile(
      'pnpm',
      ['--filter', '@news-aggregator/worker', command],
      {
        cwd: projectRoot,
        env: process.env,
        maxBuffer: 1024 * 1024 * 20,
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolvePromise({
            code: 0,
            output: `${stdout}${stderr}`,
            stderr,
            stdout,
          });
          return;
        }

        if (
          typeof error === 'object' &&
          error &&
          ('code' in error || 'stdout' in error || 'stderr' in error)
        ) {
          const code =
            typeof error.code === 'number'
              ? error.code
              : Number.parseInt(String(error.code ?? '1'), 10) || 1;
          const normalizedStdout =
            typeof error.stdout === 'string'
              ? error.stdout
              : String(stdout ?? error.stdout ?? '');
          const normalizedStderr =
            typeof error.stderr === 'string'
              ? error.stderr
              : String(stderr ?? error.stderr ?? '');

          resolvePromise({
            code,
            output: `${normalizedStdout}${normalizedStderr}`,
            stderr: normalizedStderr,
            stdout: normalizedStdout,
          });
          return;
        }

        reject(error);
      },
    );
  });
}
