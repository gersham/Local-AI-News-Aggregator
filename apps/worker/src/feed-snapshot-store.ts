import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  type FeedSnapshot,
  loadFeedSnapshotFromMongo,
} from '@news-aggregator/core';

const DEFAULT_PROJECT_ROOT = resolve(process.cwd(), '../..');

export function resolveWorkerFeedSnapshotPaths(
  options: {
    dbName?: string;
    examplePath?: string;
    legacyPath?: string;
    projectRoot?: string;
    uri?: string;
  } = {},
) {
  const projectRoot = options.projectRoot ?? DEFAULT_PROJECT_ROOT;

  return {
    examplePath:
      options.examplePath ??
      process.env.FEED_SNAPSHOT_EXAMPLE_PATH ??
      join(projectRoot, 'config', 'feed-preview.example.json'),
    legacyPath:
      options.legacyPath ??
      process.env.FEED_SNAPSHOT_LEGACY_PATH ??
      process.env.FEED_SNAPSHOT_PATH ??
      join(projectRoot, 'data', 'feed-snapshot.seed.json'),
  };
}

export async function loadWorkerFeedSnapshot(
  options: {
    dbName?: string;
    examplePath?: string;
    legacyPath?: string;
    projectRoot?: string;
    uri?: string;
  } = {},
): Promise<FeedSnapshot> {
  const paths = resolveWorkerFeedSnapshotPaths(options);
  const state = await loadFeedSnapshotFromMongo({
    dbName: options.dbName,
    feedSnapshotExamplePath: paths.examplePath,
    feedSnapshotLegacyPath: existsSync(paths.legacyPath)
      ? paths.legacyPath
      : undefined,
    uri: options.uri,
  });

  return state.snapshot;
}
