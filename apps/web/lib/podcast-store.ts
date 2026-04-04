import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  deletePodcastRunFromMongo,
  loadPodcastRunsFromMongo,
  type PodcastRun,
} from '@news-aggregator/core';

const execFileAsync = promisify(execFile);
const DEFAULT_PROJECT_ROOT = resolve(process.cwd(), '../..');

export async function loadPodcastRuns(
  options: { dbName?: string; limit?: number; uri?: string } = {},
) {
  return loadPodcastRunsFromMongo({
    dbName: options.dbName,
    limit: options.limit,
    uri: options.uri,
  });
}

export async function loadLatestPodcastRun(
  options: { dbName?: string; uri?: string } = {},
): Promise<PodcastRun | undefined> {
  const state = await loadPodcastRuns({
    dbName: options.dbName,
    limit: 1,
    uri: options.uri,
  });

  return state.runs[0];
}

export async function runPodcastGenerationCommand(options: {
  projectRoot?: string;
}) {
  const projectRoot = options.projectRoot ?? DEFAULT_PROJECT_ROOT;

  return execFileAsync(
    'pnpm',
    ['--filter', '@news-aggregator/worker', 'briefing:generate'],
    {
      cwd: projectRoot,
      env: process.env,
      maxBuffer: 1024 * 1024 * 20,
    },
  );
}

export async function readPodcastAudioFile(run: PodcastRun) {
  if (!run.audioPath) {
    throw new Error(`Podcast run "${run.runId}" has no audio path.`);
  }

  await access(run.audioPath);

  return readFile(run.audioPath);
}

export function getPodcastAudioDownloadPath(runId: string) {
  return join('/api/podcasts', runId, 'audio');
}

export async function deletePodcastRun(
  runId: string,
  options: { dbName?: string; uri?: string } = {},
) {
  return deletePodcastRunFromMongo(runId, {
    dbName: options.dbName,
    uri: options.uri,
  });
}
