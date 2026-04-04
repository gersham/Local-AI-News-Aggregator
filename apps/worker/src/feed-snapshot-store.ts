import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type FeedSnapshot, feedSnapshotSchema } from '@news-aggregator/core';

const DEFAULT_PROJECT_ROOT = resolve(process.cwd(), '../..');

export function resolveWorkerFeedSnapshotPaths(
  options: {
    examplePath?: string;
    projectRoot?: string;
    storagePath?: string;
  } = {},
) {
  const projectRoot = options.projectRoot ?? DEFAULT_PROJECT_ROOT;

  return {
    examplePath:
      options.examplePath ??
      process.env.FEED_SNAPSHOT_EXAMPLE_PATH ??
      join(projectRoot, 'config', 'feed-preview.example.json'),
    storagePath:
      options.storagePath ??
      process.env.FEED_SNAPSHOT_PATH ??
      join(projectRoot, 'data', 'feed-snapshot.json'),
  };
}

export async function loadWorkerFeedSnapshot(
  options: {
    examplePath?: string;
    projectRoot?: string;
    storagePath?: string;
  } = {},
): Promise<FeedSnapshot> {
  const paths = resolveWorkerFeedSnapshotPaths(options);
  const targetPath = existsSync(paths.storagePath)
    ? paths.storagePath
    : paths.examplePath;

  return feedSnapshotSchema.parse(JSON.parse(readFileSync(targetPath, 'utf8')));
}
