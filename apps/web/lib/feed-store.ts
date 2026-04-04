import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type FeedSnapshot, feedSnapshotSchema } from '@news-aggregator/core';

const DEFAULT_PROJECT_ROOT = resolve(process.cwd(), '../..');

export type FeedSnapshotPathOptions = {
  examplePath?: string;
  projectRoot?: string;
  storagePath?: string;
};

export type LoadedFeedSnapshotState = {
  examplePath: string;
  snapshot: FeedSnapshot;
  storagePath: string;
  usingExampleFallback: boolean;
};

export function resolveFeedSnapshotPaths(
  options: FeedSnapshotPathOptions = {},
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

export async function loadFeedSnapshot(
  options: FeedSnapshotPathOptions = {},
): Promise<LoadedFeedSnapshotState> {
  const paths = resolveFeedSnapshotPaths(options);
  const usingExampleFallback = !existsSync(paths.storagePath);
  const targetPath = usingExampleFallback
    ? paths.examplePath
    : paths.storagePath;
  const snapshot = feedSnapshotSchema.parse(
    JSON.parse(readFileSync(targetPath, 'utf8')),
  );

  return {
    examplePath: paths.examplePath,
    snapshot,
    storagePath: paths.storagePath,
    usingExampleFallback,
  };
}
