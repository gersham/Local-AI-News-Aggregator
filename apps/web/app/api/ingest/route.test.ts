import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { runWorkerCommandMock, writeActivityLogMock } = vi.hoisted(() => ({
  runWorkerCommandMock: vi.fn(),
  writeActivityLogMock: vi.fn(),
}));

vi.mock('@news-aggregator/core', () => ({
  writeActivityLog: writeActivityLogMock,
}));

vi.mock('../../../lib/worker-command', () => ({
  runWorkerCommand: runWorkerCommandMock,
}));

describe('POST /api/ingest', () => {
  beforeEach(() => {
    runWorkerCommandMock.mockReset();
    writeActivityLogMock.mockReset();
  });

  it('runs ingest without clearing the current snapshot first', async () => {
    runWorkerCommandMock.mockResolvedValue({
      code: 0,
      output: 'ingest ok',
      stderr: '',
      stdout: 'ingest ok',
    });

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(runWorkerCommandMock).toHaveBeenCalledWith('ingest:run');
    expect(payload.ok).toBe(true);
    expect(writeActivityLogMock).toHaveBeenCalledWith({
      severity: 'info',
      source: 'ingest',
      message: 'Starting ingestion run.',
    });
  });

  it('returns a 500 response when the worker command fails', async () => {
    runWorkerCommandMock.mockResolvedValue({
      code: 1,
      output: 'ingest failed',
      stderr: 'ingest failed',
      stdout: '',
    });

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Ingestion failed.');
  });
});
