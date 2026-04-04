import { z } from 'zod';

export const sourceFetchMethodSchema = z.enum([
  'x-search',
  'browser-scrape',
  'rss',
  'http',
  'exa-search',
]);

export const sourceExecutionModeSchema = z.enum([
  'active',
  'manual-opt-in',
  'disabled',
]);

export const sourceTypeSchema = z.enum([
  'social',
  'news-site',
  'watchlist',
  'newsletter',
  'custom',
]);

export const sourceDefinitionSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  type: sourceTypeSchema,
  fetchMethod: sourceFetchMethodSchema,
  enabled: z.boolean().default(true),
  executionMode: sourceExecutionModeSchema.default('active'),
  requiresAuthentication: z.boolean().default(false),
  schedule: z.string().min(1),
  topics: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  query: z.string().min(1).optional(),
  rssUrl: z.url().optional(),
  seedUrls: z.array(z.url()).default([]),
  baseWeight: z.number().min(0).max(1),
  trustWeight: z.number().min(0).max(1),
  notes: z.string().max(500).optional(),
});

export const storySchema = z.object({
  storyId: z.string(),
  clusterId: z.string().optional(),
  title: z.string(),
  canonicalUrl: z.url(),
  sourceId: z.string(),
  sourceName: z.string(),
  sourceType: sourceTypeSchema,
  publishedAt: z.iso.datetime(),
  summary: z.string(),
  topics: z.array(z.string()),
  regions: z.array(z.string()),
  citations: z.array(
    z.object({
      sourceId: z.string(),
      sourceName: z.string(),
      url: z.url(),
    }),
  ),
  importanceScore: z.number().min(0).max(1),
  personalScore: z.number().min(0).max(1),
});

export const storyClusterSchema = z.object({
  clusterId: z.string(),
  canonicalUrl: z.url(),
  citations: z.array(
    z.object({
      sourceId: z.string(),
      sourceName: z.string(),
      url: z.url(),
    }),
  ),
  headline: z.string(),
  importanceScore: z.number().min(0).max(1),
  personalScore: z.number().min(0).max(1),
  publishedAt: z.iso.datetime(),
  stories: z.array(storySchema),
  storyIds: z.array(z.string()),
});

export const feedEntrySchema = z.object({
  clusterId: z.string(),
  canonicalUrl: z.url(),
  citationCount: z.number().int().nonnegative(),
  headline: z.string(),
  publishedAt: z.iso.datetime(),
  rank: z.number().int().positive(),
  ranking: z.object({
    baseScore: z.number().min(0).max(1),
    corroborationScore: z.number().min(0).max(1),
    freshnessScore: z.number().min(0).max(1),
    sourceTypeScore: z.number().min(0).max(1),
    totalScore: z.number().min(0).max(1),
  }),
  reasons: z.array(z.string()),
  regions: z.array(z.string()),
  sourceCount: z.number().int().positive(),
  sourceNames: z.array(z.string()),
  summary: z.string(),
  topics: z.array(z.string()),
});

export const feedSnapshotSchema = z.object({
  entries: z.array(feedEntrySchema),
  generatedAt: z.iso.datetime(),
});

export const podcastRunSchema = z.object({
  runId: z.string(),
  date: z.iso.date(),
  durationSec: z.number().int().positive().optional(),
  transcriptPath: z.string().optional(),
  audioPath: z.string().optional(),
});

export const starterTopics = [
  { slug: 'x-feed', label: 'My X Feed', scope: 'personal signal' },
  { slug: 'reddit-feed', label: 'My Reddit Feed', scope: 'logged-in social' },
  { slug: 'lantzville', label: 'Lantzville BC News', scope: 'hyperlocal' },
  { slug: 'bc', label: 'BC News', scope: 'regional' },
  { slug: 'vancouver', label: 'Vancouver News', scope: 'metro' },
  { slug: 'canada', label: 'Canada News', scope: 'national' },
  {
    slug: 'international',
    label: 'UK / USA / Ireland / China / Japan / Thailand',
    scope: 'international',
  },
  { slug: 'ai', label: 'AI News', scope: 'industry' },
  { slug: 'tech', label: 'Tech News', scope: 'industry' },
  {
    slug: 'singularity',
    label: 'News About The Singularity',
    scope: 'watchlist',
  },
] as const;

export const systemCapabilityHeadings = [
  {
    title: 'Ranked Feed',
    summary:
      'Extensive priority-ordered feed with explainable scoring and later feedback loops.',
  },
  {
    title: 'Admin Control',
    summary:
      'Source registry, credentials, ranking controls, schedules, and run orchestration.',
  },
  {
    title: 'Morning Briefing',
    summary:
      'Anchor-led script and audio pipeline with multi-voice support and Sonos playback.',
  },
] as const;

export const defaultOperationalSettings = {
  morningBriefingTime: '07:00',
  morningBriefingTimezone: 'America/Vancouver',
} as const;

export type SourceDefinition = z.infer<typeof sourceDefinitionSchema>;
export type SourceRegistry = {
  sources: SourceDefinition[];
};
export type FeedEntry = z.infer<typeof feedEntrySchema>;
export type FeedSnapshot = z.infer<typeof feedSnapshotSchema>;
export type StoryCluster = z.infer<typeof storyClusterSchema>;
export type Story = z.infer<typeof storySchema>;
export type PodcastRun = z.infer<typeof podcastRunSchema>;
