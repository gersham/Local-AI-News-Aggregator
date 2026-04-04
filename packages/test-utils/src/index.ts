import { sourceDefinitionSchema } from '@news-aggregator/core';

export function buildSourceFixture(overrides = {}) {
  return sourceDefinitionSchema.parse({
    id: 'fixture-source',
    name: 'Fixture Source',
    type: 'news-site',
    fetchMethod: 'rss',
    enabled: true,
    schedule: '0 * * * *',
    topics: ['ai'],
    regions: ['global'],
    seedUrls: [],
    baseWeight: 0.8,
    trustWeight: 0.85,
    ...overrides,
  });
}
