import {
  clusterStories,
  type FeedSnapshot,
  materializeFeedSnapshot,
  type SourceDefinition,
  saveFeedSnapshotToMongo,
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

export async function writeFeedSnapshot(
  snapshot: FeedSnapshot,
  options: {
    dbName?: string;
    uri?: string;
  } = {},
) {
  const saved = await saveFeedSnapshotToMongo(snapshot, options);

  return saved.snapshot;
}
