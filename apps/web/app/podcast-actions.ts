'use server';

import { revalidatePath } from 'next/cache';
import {
  loadLatestPodcastRun,
  runPodcastGenerationCommand,
} from '../lib/podcast-store';

export async function generatePodcastAction(_previousState?: unknown) {
  await runPodcastGenerationCommand({});

  const run = await loadLatestPodcastRun();

  revalidatePath('/');
  revalidatePath('/feed');
  revalidatePath('/podcasts');

  return {
    run,
    status: 'success' as const,
  };
}
