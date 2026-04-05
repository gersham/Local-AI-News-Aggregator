import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runWorkerCommand } from './worker-command';

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

describe('runWorkerCommand', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it('runs worker commands from the repo root', async () => {
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      callback(null, 'ok stdout', 'ok stderr');
    });

    const result = await runWorkerCommand('briefing:generate', {
      projectRoot: '/tmp/news-aggregator',
    });

    expect(execFileMock).toHaveBeenCalledWith(
      'pnpm',
      ['--filter', '@news-aggregator/worker', 'briefing:generate'],
      expect.objectContaining({
        cwd: '/tmp/news-aggregator',
      }),
      expect.any(Function),
    );
    expect(result).toEqual({
      code: 0,
      output: 'ok stdoutok stderr',
      stderr: 'ok stderr',
      stdout: 'ok stdout',
    });
  });

  it('normalizes non-zero command failures into a structured result', async () => {
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      const error = Object.assign(new Error('failed'), {
        code: 2,
        stderr: 'bad stderr',
        stdout: 'bad stdout',
      });
      callback(error, 'bad stdout', 'bad stderr');
    });

    const result = await runWorkerCommand('ingest:run', {
      projectRoot: '/tmp/news-aggregator',
    });

    expect(result).toEqual({
      code: 2,
      output: 'bad stdoutbad stderr',
      stderr: 'bad stderr',
      stdout: 'bad stdout',
    });
  });
});
