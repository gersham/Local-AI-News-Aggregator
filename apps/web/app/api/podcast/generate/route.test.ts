import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { runPodcastGenerationCommandMock, writeActivityLogMock } = vi.hoisted(
  () => ({
    runPodcastGenerationCommandMock: vi.fn(),
    writeActivityLogMock: vi.fn(),
  }),
);

vi.mock('@news-aggregator/core', () => ({
  writeActivityLog: writeActivityLogMock,
}));

vi.mock('../../../../lib/podcast-store', () => ({
  runPodcastGenerationCommand: runPodcastGenerationCommandMock,
}));

describe('POST /api/podcast/generate', () => {
  beforeEach(() => {
    runPodcastGenerationCommandMock.mockReset();
    writeActivityLogMock.mockReset();
  });

  it('runs the same generation command used by the dashboard action', async () => {
    runPodcastGenerationCommandMock.mockResolvedValue({
      code: 0,
      output: 'podcast ok',
      stderr: '',
      stdout: 'podcast ok',
    });

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(runPodcastGenerationCommandMock).toHaveBeenCalledWith({});
    expect(payload.ok).toBe(true);
  });

  it('returns a 500 response when generation fails', async () => {
    runPodcastGenerationCommandMock.mockResolvedValue({
      code: 1,
      output: 'bad output',
      stderr: 'bad output',
      stdout: '',
    });

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Podcast generation failed.');
  });
});
