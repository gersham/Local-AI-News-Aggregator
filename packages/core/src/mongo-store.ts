import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { type Db, MongoClient, ObjectId } from 'mongodb';
import { parseSourceRegistry, type SourceRegistry } from './config';
import type {
  FeedSnapshot,
  PodcastRun,
  SourceDefinition,
  Story,
  StoryCluster,
} from './domain';
import {
  feedSnapshotSchema,
  podcastRunSchema,
  storyClusterSchema,
  storySchema,
} from './domain';
import { normalizeCanonicalUrl } from './normalize';
import {
  readSourceRegistryFromFile,
  upsertSourceDefinition,
} from './source-registry';

const mongoClientPromiseByUri = new Map<string, Promise<MongoClient>>();
const articleCacheTtlDays = 30;

const collectionNames = {
  appState: 'app_state',
  articleCache: 'article_cache',
  discoveryArtifacts: 'discovery_artifacts',
  ingestRuns: 'ingest_runs',
  podcastRuns: 'podcast_runs',
  stories: 'stories',
  storyClusters: 'story_clusters',
} as const;

type MongoConnectionOptions = {
  client?: MongoClient;
  dbName?: string;
  uri?: string;
};

export type { MongoConnectionOptions };

type SourceRegistryDocument = {
  _id: 'source-registry';
  registry: SourceRegistry;
  seedSource: 'example-file' | 'legacy-file' | 'manual';
  updatedAt: string;
};

type FeedSnapshotDocument = {
  _id: 'feed-snapshot';
  seedSource: 'example-file' | 'legacy-file' | 'run';
  snapshot: FeedSnapshot;
  updatedAt: string;
};

type DiscoveryArtifactDocument = {
  _id?: ObjectId;
  artifactKey: string;
  content: string;
  createdAt: string;
  extension: string;
  fetchedAt: string;
  sourceId: string;
  target: string;
};

type ArticleCacheDocument = {
  _id?: ObjectId;
  article: {
    id?: string;
    publishedDate?: string;
    summary?: string;
    text?: string;
    title?: string;
    url: string;
  };
  cachedAt: Date;
  expiresAt: Date;
  normalizedUrl: string;
  urlHash: string;
};

type IngestRunDocument = {
  _id?: ObjectId;
  candidates: unknown[];
  clusterIds?: string[];
  createdAt: string;
  discoveryCount: number;
  enrichedStories: unknown[];
  enrichedStoryCount: number;
  feedSnapshot: FeedSnapshot;
  generatedAt: string;
  rawArtifactIds: string[];
  storyIds?: string[];
};

type PodcastRunDocument = {
  _id?: ObjectId;
  audioPath?: string;
  date: string;
  durationSec?: number;
  generatedAt: string;
  run: {
    audioPath?: string;
    date: string;
    durationSec?: number;
    generatedAt: string;
    runId: string;
    transcript?: string;
    transcriptPath?: string;
  };
  runId: string;
  transcript?: string;
  transcriptPath?: string;
  updatedAt: string;
};

type StoryDocument = {
  _id?: ObjectId;
  canonicalUrl: string;
  generatedAt: string;
  publishedAt: string;
  regions: string[];
  sourceId: string;
  story: Story;
  storyId: string;
  topics: string[];
  updatedAt: string;
};

type StoryClusterDocument = {
  _id?: ObjectId;
  canonicalUrl: string;
  cluster: StoryCluster;
  clusterId: string;
  generatedAt: string;
  publishedAt: string;
  regions: string[];
  storyIds: string[];
  topics: string[];
  updatedAt: string;
};

export type SourceRegistryMongoState = {
  examplePath?: string;
  registry: SourceRegistry;
  storageTarget: string;
  usingExampleFallback: boolean;
};

export type FeedSnapshotMongoState = {
  examplePath?: string;
  snapshot: FeedSnapshot;
  storageTarget: string;
  usingExampleFallback: boolean;
};

export type SavedDiscoveryArtifact = {
  artifactId: string;
  storageTarget: string;
};

export type CachedArticleLookup = {
  hits: Array<ArticleCacheDocument['article']>;
  misses: string[];
  storageTarget: string;
};

export type SavedIngestRun = {
  runId: string;
  storageTarget: string;
};

export type StoryMongoState = {
  stories: Story[];
  storageTarget: string;
};

export type StoryClusterMongoState = {
  clusters: StoryCluster[];
  storageTarget: string;
};

export type PodcastRunMongoState = {
  runs: PodcastRun[];
  storageTarget: string;
};

export type SavedPodcastRun = {
  run: PodcastRun;
  storageTarget: string;
};

export type SourceDefinitionPatch = Partial<
  Pick<
    SourceDefinition,
    | 'additionalQueries'
    | 'baseWeight'
    | 'enabled'
    | 'exaCategory'
    | 'exaNumResults'
    | 'exaSearchType'
    | 'exaUserLocation'
    | 'executionMode'
    | 'excludeDomains'
    | 'includeDomains'
    | 'notes'
    | 'query'
    | 'regions'
    | 'topics'
    | 'trustWeight'
  >
>;

function normalizeUrlForCache(input: string) {
  try {
    return normalizeCanonicalUrl(input);
  } catch {
    return input.trim();
  }
}

function hashUrlForCache(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

async function getArticleCacheCollection(db: Db) {
  const collection = db.collection<ArticleCacheDocument>(
    collectionNames.articleCache,
  );

  await Promise.all([
    collection.createIndex(
      { urlHash: 1 },
      {
        name: 'article_cache_url_hash',
        unique: true,
      },
    ),
    collection.createIndex(
      { expiresAt: 1 },
      {
        expireAfterSeconds: 0,
        name: 'article_cache_ttl',
      },
    ),
  ]);

  return collection;
}

async function getStoriesCollection(db: Db) {
  const collection = db.collection<StoryDocument>(collectionNames.stories);

  await Promise.all([
    collection.createIndex(
      { storyId: 1 },
      {
        name: 'stories_story_id',
        unique: true,
      },
    ),
    collection.createIndex(
      { canonicalUrl: 1 },
      {
        name: 'stories_canonical_url',
      },
    ),
    collection.createIndex(
      { generatedAt: -1, publishedAt: -1 },
      {
        name: 'stories_generated_at',
      },
    ),
    collection.createIndex(
      { sourceId: 1, generatedAt: -1 },
      {
        name: 'stories_source_generated_at',
      },
    ),
    collection.createIndex(
      { topics: 1, generatedAt: -1 },
      {
        name: 'stories_topics_generated_at',
      },
    ),
    collection.createIndex(
      { regions: 1, generatedAt: -1 },
      {
        name: 'stories_regions_generated_at',
      },
    ),
  ]);

  return collection;
}

async function getStoryClustersCollection(db: Db) {
  const collection = db.collection<StoryClusterDocument>(
    collectionNames.storyClusters,
  );

  await Promise.all([
    collection.createIndex(
      { clusterId: 1 },
      {
        name: 'story_clusters_cluster_id',
        unique: true,
      },
    ),
    collection.createIndex(
      { canonicalUrl: 1 },
      {
        name: 'story_clusters_canonical_url',
      },
    ),
    collection.createIndex(
      { generatedAt: -1, publishedAt: -1 },
      {
        name: 'story_clusters_generated_at',
      },
    ),
    collection.createIndex(
      { topics: 1, generatedAt: -1 },
      {
        name: 'story_clusters_topics_generated_at',
      },
    ),
    collection.createIndex(
      { regions: 1, generatedAt: -1 },
      {
        name: 'story_clusters_regions_generated_at',
      },
    ),
  ]);

  return collection;
}

async function getPodcastRunsCollection(db: Db) {
  const collection = db.collection<PodcastRunDocument>(
    collectionNames.podcastRuns,
  );

  await Promise.all([
    collection.createIndex(
      { runId: 1 },
      {
        name: 'podcast_runs_run_id',
        unique: true,
      },
    ),
    collection.createIndex(
      { generatedAt: -1 },
      {
        name: 'podcast_runs_generated_at',
      },
    ),
    collection.createIndex(
      { date: -1, generatedAt: -1 },
      {
        name: 'podcast_runs_date_generated_at',
      },
    ),
  ]);

  return collection;
}

function getMongoDbName(options: MongoConnectionOptions) {
  return (
    options.dbName ?? process.env.MONGODB_DB_NAME ?? 'local_ai_news_aggregator'
  );
}

function getMongoUri(options: MongoConnectionOptions) {
  const uri = options.uri ?? process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is required for MongoDB-backed persistence.');
  }

  return uri;
}

async function getMongoClient(options: MongoConnectionOptions) {
  if (options.client) {
    return options.client;
  }

  const uri = getMongoUri(options);
  const existing = mongoClientPromiseByUri.get(uri);

  if (existing) {
    return existing;
  }

  const promise = new MongoClient(uri).connect();
  mongoClientPromiseByUri.set(uri, promise);

  return promise;
}

async function getMongoDb(options: MongoConnectionOptions) {
  const client = await getMongoClient(options);

  return client.db(getMongoDbName(options));
}

function getStorageTarget(
  options: MongoConnectionOptions,
  collectionName: string,
) {
  return `mongodb:${getMongoDbName(options)}/${collectionName}`;
}

function readJsonFile<T>(
  path: string | undefined,
  parser: (input: unknown) => T,
) {
  if (!path || !existsSync(path)) {
    return undefined;
  }

  return parser(JSON.parse(readFileSync(path, 'utf8')));
}

async function saveSourceRegistryDocument(
  db: Db,
  registry: SourceRegistry,
  seedSource: SourceRegistryDocument['seedSource'],
) {
  const validated = parseSourceRegistry(registry);

  await db
    .collection<SourceRegistryDocument>(collectionNames.appState)
    .updateOne(
      { _id: 'source-registry' },
      {
        $set: {
          _id: 'source-registry',
          registry: validated,
          seedSource,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );

  return validated;
}

async function saveFeedSnapshotDocument(
  db: Db,
  snapshot: FeedSnapshot,
  seedSource: FeedSnapshotDocument['seedSource'],
) {
  const validated = feedSnapshotSchema.parse(snapshot);

  await db.collection<FeedSnapshotDocument>(collectionNames.appState).updateOne(
    { _id: 'feed-snapshot' },
    {
      $set: {
        _id: 'feed-snapshot',
        seedSource,
        snapshot: validated,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  );

  return validated;
}

export async function loadSourceRegistryFromMongo(
  options: MongoConnectionOptions & {
    sourceRegistryExamplePath?: string;
    sourceRegistryLegacyPath?: string;
  } = {},
): Promise<SourceRegistryMongoState> {
  const db = await getMongoDb(options);
  const collection = db.collection<SourceRegistryDocument>(
    collectionNames.appState,
  );
  const existing = await collection.findOne({ _id: 'source-registry' });

  if (existing) {
    return {
      examplePath: options.sourceRegistryExamplePath,
      registry: parseSourceRegistry(existing.registry),
      storageTarget: getStorageTarget(options, collectionNames.appState),
      usingExampleFallback: false,
    };
  }

  const registry =
    readJsonFile(options.sourceRegistryLegacyPath, parseSourceRegistry) ??
    (options.sourceRegistryExamplePath
      ? readSourceRegistryFromFile(options.sourceRegistryExamplePath)
      : parseSourceRegistry({ sources: [] }));
  const seedSource =
    options.sourceRegistryLegacyPath &&
    existsSync(options.sourceRegistryLegacyPath)
      ? 'legacy-file'
      : 'example-file';
  const validated = await saveSourceRegistryDocument(db, registry, seedSource);

  return {
    examplePath: options.sourceRegistryExamplePath,
    registry: validated,
    storageTarget: getStorageTarget(options, collectionNames.appState),
    usingExampleFallback: seedSource === 'example-file',
  };
}

export async function saveSourceRegistryToMongo(
  registry: SourceRegistry,
  options: MongoConnectionOptions = {},
) {
  const db = await getMongoDb(options);
  const validated = await saveSourceRegistryDocument(db, registry, 'manual');

  return {
    registry: validated,
    storageTarget: getStorageTarget(options, collectionNames.appState),
  };
}

export async function updateSourceDefinitionInMongo(
  options: MongoConnectionOptions & {
    id: string;
    patch: SourceDefinitionPatch;
    sourceRegistryExamplePath?: string;
    sourceRegistryLegacyPath?: string;
  },
) {
  const current = await loadSourceRegistryFromMongo(options);
  const existing = current.registry.sources.find(
    (source) => source.id === options.id,
  );

  if (!existing) {
    throw new Error(`Source "${options.id}" was not found.`);
  }

  const sanitizedPatch = Object.fromEntries(
    Object.entries(options.patch).filter(([, value]) => value !== undefined),
  ) as SourceDefinitionPatch;
  const nextRegistry = upsertSourceDefinition(current.registry, {
    ...existing,
    ...sanitizedPatch,
  });
  const saved = await saveSourceRegistryToMongo(nextRegistry, options);

  return {
    registry: saved.registry,
    storageTarget: saved.storageTarget,
    usingExampleFallback: false,
  };
}

export async function loadFeedSnapshotFromMongo(
  options: MongoConnectionOptions & {
    feedSnapshotExamplePath?: string;
    feedSnapshotLegacyPath?: string;
  } = {},
): Promise<FeedSnapshotMongoState> {
  const db = await getMongoDb(options);
  const collection = db.collection<FeedSnapshotDocument>(
    collectionNames.appState,
  );
  const existing = await collection.findOne({ _id: 'feed-snapshot' });

  if (existing) {
    return {
      examplePath: options.feedSnapshotExamplePath,
      snapshot: feedSnapshotSchema.parse(existing.snapshot),
      storageTarget: getStorageTarget(options, collectionNames.appState),
      usingExampleFallback: false,
    };
  }

  const snapshot = readJsonFile(
    options.feedSnapshotLegacyPath,
    feedSnapshotSchema.parse,
  ) ??
    readJsonFile(options.feedSnapshotExamplePath, feedSnapshotSchema.parse) ?? {
      entries: [],
      generatedAt: new Date().toISOString(),
    };
  const seedSource =
    options.feedSnapshotLegacyPath && existsSync(options.feedSnapshotLegacyPath)
      ? 'legacy-file'
      : 'example-file';
  const validated = await saveFeedSnapshotDocument(db, snapshot, seedSource);

  return {
    examplePath: options.feedSnapshotExamplePath,
    snapshot: validated,
    storageTarget: getStorageTarget(options, collectionNames.appState),
    usingExampleFallback: seedSource === 'example-file',
  };
}

export async function saveFeedSnapshotToMongo(
  snapshot: FeedSnapshot,
  options: MongoConnectionOptions = {},
) {
  const db = await getMongoDb(options);
  const validated = await saveFeedSnapshotDocument(db, snapshot, 'run');

  return {
    snapshot: validated,
    storageTarget: getStorageTarget(options, collectionNames.appState),
  };
}

export function getMongoCollectionNames() {
  return collectionNames;
}

export async function loadCachedArticlesFromMongo(
  urls: string[],
  options: MongoConnectionOptions = {},
): Promise<CachedArticleLookup> {
  const uniqueUrls = Array.from(
    new Set(urls.map((url) => url.trim()).filter(Boolean)),
  );

  if (uniqueUrls.length === 0) {
    return {
      hits: [],
      misses: [],
      storageTarget: getStorageTarget(options, collectionNames.articleCache),
    };
  }

  const db = await getMongoDb(options);
  const collection = await getArticleCacheCollection(db);
  const normalizedUrlByInput = new Map(
    uniqueUrls.map((url) => [url, normalizeUrlForCache(url)]),
  );
  const hashByInput = new Map(
    uniqueUrls.map((url) => {
      const normalizedUrl = normalizedUrlByInput.get(url) ?? url;

      return [url, hashUrlForCache(normalizedUrl)];
    }),
  );
  const documents = await collection
    .find({
      urlHash: {
        $in: Array.from(new Set(hashByInput.values())),
      },
    })
    .toArray();
  const documentByHash = new Map(
    documents.map((document) => [document.urlHash, document]),
  );
  const hits: Array<ArticleCacheDocument['article']> = [];
  const misses: string[] = [];

  for (const url of uniqueUrls) {
    const hash = hashByInput.get(url);
    const normalizedUrl = normalizedUrlByInput.get(url) ?? url;
    const document = hash ? documentByHash.get(hash) : undefined;

    if (document) {
      hits.push({
        ...document.article,
        url: normalizedUrl,
      });
      continue;
    }

    misses.push(url);
  }

  return {
    hits,
    misses,
    storageTarget: getStorageTarget(options, collectionNames.articleCache),
  };
}

export async function saveCachedArticlesToMongo(
  articles: Array<{
    id?: string;
    publishedDate?: string;
    summary?: string;
    text?: string;
    title?: string;
    url?: string;
  }>,
  options: MongoConnectionOptions & {
    ttlDays?: number;
  } = {},
) {
  const validArticles = articles.filter(
    (article): article is NonNullable<typeof article> & { url: string } =>
      typeof article.url === 'string' && article.url.trim().length > 0,
  );

  if (validArticles.length === 0) {
    return {
      storedCount: 0,
      storageTarget: getStorageTarget(options, collectionNames.articleCache),
    };
  }

  const db = await getMongoDb(options);
  const collection = await getArticleCacheCollection(db);
  const cachedAt = new Date();
  const ttlDays = options.ttlDays ?? articleCacheTtlDays;
  const expiresAt = new Date(
    cachedAt.getTime() + ttlDays * 24 * 60 * 60 * 1000,
  );
  const operations = validArticles.map((article) => {
    const normalizedUrl = normalizeUrlForCache(article.url);
    const urlHash = hashUrlForCache(normalizedUrl);

    return {
      updateOne: {
        filter: {
          urlHash,
        },
        update: {
          $set: {
            article: {
              ...article,
              url: normalizedUrl,
            },
            cachedAt,
            expiresAt,
            normalizedUrl,
            urlHash,
          },
        },
        upsert: true,
      },
    };
  });

  await collection.bulkWrite(operations, {
    ordered: false,
  });

  return {
    storedCount: operations.length,
    storageTarget: getStorageTarget(options, collectionNames.articleCache),
  };
}

export async function loadStoriesFromMongo(
  options: MongoConnectionOptions & {
    limit?: number;
    region?: string;
    sourceId?: string;
    topic?: string;
  } = {},
): Promise<StoryMongoState> {
  const db = await getMongoDb(options);
  const collection = await getStoriesCollection(db);
  const query: Record<string, unknown> = {};

  if (options.sourceId) {
    query.sourceId = options.sourceId;
  }

  if (options.topic) {
    query.topics = options.topic;
  }

  if (options.region) {
    query.regions = options.region;
  }

  const documents = await collection
    .find(query)
    .sort({
      generatedAt: -1,
      publishedAt: -1,
    })
    .limit(options.limit ?? 50)
    .toArray();

  return {
    stories: documents.map((document) => storySchema.parse(document.story)),
    storageTarget: getStorageTarget(options, collectionNames.stories),
  };
}

export async function saveStoriesToMongo(
  stories: Story[],
  options: MongoConnectionOptions & {
    generatedAt?: string;
  } = {},
) {
  if (stories.length === 0) {
    return {
      storedCount: 0,
      storageTarget: getStorageTarget(options, collectionNames.stories),
    };
  }

  const db = await getMongoDb(options);
  const collection = await getStoriesCollection(db);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const operations = stories.map((story) => {
    const validated = storySchema.parse(story);

    return {
      updateOne: {
        filter: {
          storyId: validated.storyId,
        },
        update: {
          $set: {
            canonicalUrl: validated.canonicalUrl,
            generatedAt,
            publishedAt: validated.publishedAt,
            regions: validated.regions,
            sourceId: validated.sourceId,
            story: validated,
            storyId: validated.storyId,
            topics: validated.topics,
            updatedAt,
          },
        },
        upsert: true,
      },
    };
  });

  await collection.bulkWrite(operations, {
    ordered: false,
  });

  return {
    storedCount: operations.length,
    storageTarget: getStorageTarget(options, collectionNames.stories),
  };
}

export async function loadStoryClustersFromMongo(
  options: MongoConnectionOptions & {
    limit?: number;
    region?: string;
    topic?: string;
  } = {},
): Promise<StoryClusterMongoState> {
  const db = await getMongoDb(options);
  const collection = await getStoryClustersCollection(db);
  const query: Record<string, unknown> = {};

  if (options.topic) {
    query.topics = options.topic;
  }

  if (options.region) {
    query.regions = options.region;
  }

  const documents = await collection
    .find(query)
    .sort({
      generatedAt: -1,
      publishedAt: -1,
    })
    .limit(options.limit ?? 50)
    .toArray();

  return {
    clusters: documents.map((document) =>
      storyClusterSchema.parse(document.cluster),
    ),
    storageTarget: getStorageTarget(options, collectionNames.storyClusters),
  };
}

export async function saveStoryClustersToMongo(
  clusters: StoryCluster[],
  options: MongoConnectionOptions & {
    generatedAt?: string;
  } = {},
) {
  if (clusters.length === 0) {
    return {
      storedCount: 0,
      storageTarget: getStorageTarget(options, collectionNames.storyClusters),
    };
  }

  const db = await getMongoDb(options);
  const collection = await getStoryClustersCollection(db);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const operations = clusters.map((cluster) => {
    const validated = storyClusterSchema.parse(cluster);
    const topics = Array.from(
      new Set(validated.stories.flatMap((story) => story.topics)),
    );
    const regions = Array.from(
      new Set(validated.stories.flatMap((story) => story.regions)),
    );

    return {
      updateOne: {
        filter: {
          clusterId: validated.clusterId,
        },
        update: {
          $set: {
            canonicalUrl: validated.canonicalUrl,
            cluster: validated,
            clusterId: validated.clusterId,
            generatedAt,
            publishedAt: validated.publishedAt,
            regions,
            storyIds: validated.storyIds,
            topics,
            updatedAt,
          },
        },
        upsert: true,
      },
    };
  });

  await collection.bulkWrite(operations, {
    ordered: false,
  });

  return {
    storedCount: operations.length,
    storageTarget: getStorageTarget(options, collectionNames.storyClusters),
  };
}

export async function loadPodcastRunsFromMongo(
  options: MongoConnectionOptions & {
    limit?: number;
  } = {},
): Promise<PodcastRunMongoState> {
  const db = await getMongoDb(options);
  const collection = await getPodcastRunsCollection(db);
  const documents = await collection
    .find({})
    .sort({
      generatedAt: -1,
    })
    .limit(options.limit ?? 25)
    .toArray();

  return {
    runs: documents.map((document) => podcastRunSchema.parse(document.run)),
    storageTarget: getStorageTarget(options, collectionNames.podcastRuns),
  };
}

export async function savePodcastRunToMongo(
  input: {
    audioPath?: string;
    date: string;
    durationSec?: number;
    generatedAt: string;
    runId?: string;
    transcript?: string;
    transcriptPath?: string;
  },
  options: MongoConnectionOptions = {},
): Promise<SavedPodcastRun> {
  const db = await getMongoDb(options);
  const collection = await getPodcastRunsCollection(db);
  const runId = input.runId ?? new ObjectId().toString();
  const run = podcastRunSchema.parse({
    audioPath: input.audioPath,
    date: input.date,
    durationSec: input.durationSec,
    generatedAt: input.generatedAt,
    runId,
    transcript: input.transcript,
    transcriptPath: input.transcriptPath,
  });
  const sanitizedRun = Object.fromEntries(
    Object.entries(run).filter(([, value]) => value !== undefined),
  ) as PodcastRun;
  const sanitizedRunDocument = Object.fromEntries(
    Object.entries({
      audioPath: run.audioPath,
      date: run.date,
      durationSec: run.durationSec,
      generatedAt: run.generatedAt,
      run: sanitizedRun,
      runId: run.runId,
      transcript: run.transcript,
      transcriptPath: run.transcriptPath,
      updatedAt: new Date().toISOString(),
    }).filter(([, value]) => value !== undefined),
  );

  await collection.updateOne(
    { runId },
    {
      $set: sanitizedRunDocument,
    },
    {
      upsert: true,
    },
  );

  return {
    run,
    storageTarget: getStorageTarget(options, collectionNames.podcastRuns),
  };
}

export async function saveDiscoveryArtifactToMongo(
  artifact: Omit<DiscoveryArtifactDocument, '_id' | 'createdAt'>,
  options: MongoConnectionOptions = {},
): Promise<SavedDiscoveryArtifact> {
  const db = await getMongoDb(options);
  const result = await db
    .collection<DiscoveryArtifactDocument>(collectionNames.discoveryArtifacts)
    .insertOne({
      ...artifact,
      createdAt: new Date().toISOString(),
    });

  return {
    artifactId: result.insertedId.toString(),
    storageTarget: getStorageTarget(
      options,
      collectionNames.discoveryArtifacts,
    ),
  };
}

export async function saveIngestRunToMongo(
  input: Omit<
    IngestRunDocument,
    '_id' | 'createdAt' | 'discoveryCount' | 'enrichedStoryCount'
  > & {
    discoveryCount?: number;
    enrichedStoryCount?: number;
  },
  options: MongoConnectionOptions = {},
): Promise<SavedIngestRun> {
  const db = await getMongoDb(options);
  const result = await db
    .collection<IngestRunDocument>(collectionNames.ingestRuns)
    .insertOne({
      candidates: input.candidates,
      createdAt: new Date().toISOString(),
      discoveryCount: input.discoveryCount ?? input.candidates.length,
      enrichedStories: input.enrichedStories,
      enrichedStoryCount:
        input.enrichedStoryCount ?? input.enrichedStories.length,
      feedSnapshot: feedSnapshotSchema.parse(input.feedSnapshot),
      generatedAt: input.generatedAt,
      rawArtifactIds: input.rawArtifactIds,
      clusterIds: input.clusterIds,
      storyIds: input.storyIds,
    });

  return {
    runId: result.insertedId.toString(),
    storageTarget: getStorageTarget(options, collectionNames.ingestRuns),
  };
}

export async function deletePodcastRunFromMongo(
  runId: string,
  options: MongoConnectionOptions = {},
) {
  const db = await getMongoDb(options);
  const collection = await getPodcastRunsCollection(db);

  await collection.deleteOne({ runId });

  return { deleted: true, runId };
}
