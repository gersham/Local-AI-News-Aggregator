import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

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
    writeActivityLogMock.mockReset().mockResolvedValue(undefined);
  });

  it('returns immediately with started status', async () => {
    runPodcastGenerationCommandMock.mockReturnValue(
      new Promise(() => {}), // never resolves — simulates long-running generation
    );

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, status: 'started' });
    expect(runPodcastGenerationCommandMock).toHaveBeenCalledWith({});
  });
});

describe('GET /api/podcast/generate', () => {
  it('reports generation status', async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toHaveProperty('generating');
  });
});
