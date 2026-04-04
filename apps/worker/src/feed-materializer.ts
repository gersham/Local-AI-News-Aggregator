import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  clusterStories,
  type FeedSnapshot,
  feedSnapshotSchema,
  materializeFeedSnapshot,
  type SourceDefinition,
} from '@news-aggregator/core';
import {
  normalizeExaSearchArtifact,
  normalizeXSearchExecutionResult,
} from './normalize-ingestion';
import type { ExecutedPublicSourceFetch } from './public-sources';
import type { XSearchResponsePayload } from './x-search';

export function materializeFeedFromArtifacts(input: {
  generatedAt: string;
  publicArtifacts: Array<{
    artifact: ExecutedPublicSourceFetch;
    source: SourceDefinition;
  }>;
  sourceIndex: Map<string, SourceDefinition>;
  xSearchResults: Array<{
    result: {
      content: XSearchResponsePayload;
      sourceId: string;
    };
    source: SourceDefinition;
  }>;
}) {
  const stories = [
    ...input.publicArtifacts.flatMap(({ artifact, source }) => {
      if (artifact.artifactKey === 'discovery-exa-search') {
        return normalizeExaSearchArtifact({ artifact, source });
      }

      return [];
    }),
    ...input.xSearchResults.flatMap(({ result, source }) =>
      normalizeXSearchExecutionResult({ result, source }),
    ),
  ];

  return materializeFeedSnapshot(clusterStories(stories), {
    generatedAt: input.generatedAt,
  });
}

export async function writeFeedSnapshot(path: string, snapshot: FeedSnapshot) {
  const validated = feedSnapshotSchema.parse(snapshot);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');

  return validated;
}
