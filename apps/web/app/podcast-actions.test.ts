import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePodcastAction } from './podcast-actions';

const {
  loadLatestPodcastRunMock,
  revalidatePathMock,
  runPodcastGenerationCommandMock,
} = vi.hoisted(() => ({
  loadLatestPodcastRunMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  runPodcastGenerationCommandMock: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('../lib/podcast-store', () => ({
  loadLatestPodcastRun: loadLatestPodcastRunMock,
  runPodcastGenerationCommand: runPodcastGenerationCommandMock,
}));

describe('generatePodcastAction', () => {
  beforeEach(() => {
    revalidatePathMock.mockReset();
    loadLatestPodcastRunMock.mockReset();
    runPodcastGenerationCommandMock.mockReset();
  });

  it('runs the worker audio flow, reloads the latest podcast, and revalidates dashboard pages', async () => {
    runPodcastGenerationCommandMock.mockResolvedValue({
      code: 0,
      stderr: '',
      stdout: 'MP3 written',
    });
    loadLatestPodcastRunMock.mockResolvedValue({
      audioPath:
        '/Users/gersham/Sources/personal/NewsAggregator/artifacts/briefings/2026-04-04/morning-briefing.mp3',
      date: '2026-04-04',
      generatedAt: '2026-04-04T22:00:00.000Z',
      runId: 'run_123',
      transcriptPath:
        '/Users/gersham/Sources/personal/NewsAggregator/artifacts/briefings/2026-04-04/morning-briefing.txt',
    });

    const result = await generatePodcastAction();

    expect(runPodcastGenerationCommandMock).toHaveBeenCalledOnce();
    expect(loadLatestPodcastRunMock).toHaveBeenCalledOnce();
    expect(revalidatePathMock).toHaveBeenCalledWith('/');
    expect(revalidatePathMock).toHaveBeenCalledWith('/feed');
    expect(revalidatePathMock).toHaveBeenCalledWith('/podcasts');
    expect(result.status).toBe('success');
    expect(result.run).toMatchObject({
      runId: 'run_123',
      date: '2026-04-04',
    });
  });
});
