import { describe, expect, it } from 'vitest';
import {
  loadRuntimeConfig,
  parseSourceRegistry,
  runtimeEnvSchema,
} from './index';

describe('runtimeEnvSchema', () => {
  it('accepts the required runtime environment fields', () => {
    const result = runtimeEnvSchema.parse({
      APP_BASE_URL: 'http://localhost:3000',
      MORNING_BRIEFING_TIME: '07:00',
      MORNING_BRIEFING_TIMEZONE: 'America/Vancouver',
      XAI_API_KEY: 'xai-test-key',
      EXA_API_KEY: 'exa-test-key',
      ELEVENLABS_API_KEY: 'elevenlabs-test-key',
      SONOS_TARGET_ROOM: 'Bedroom Ceiling',
      AUDIO_HOST_BASE_URL: 'http://arch.local:9999',
    });

    expect(result.MORNING_BRIEFING_TIME).toBe('07:00');
    expect(result.SONOS_TARGET_ROOM).toBe('Bedroom Ceiling');
  });
});

describe('loadRuntimeConfig', () => {
  it('returns a normalized config object', () => {
    const config = loadRuntimeConfig({
      APP_BASE_URL: 'http://localhost:3000',
      MORNING_BRIEFING_TIME: '07:00',
      MORNING_BRIEFING_TIMEZONE: 'America/Vancouver',
      XAI_API_KEY: 'xai-test-key',
      EXA_API_KEY: 'exa-test-key',
      ELEVENLABS_API_KEY: 'elevenlabs-test-key',
      SONOS_TARGET_ROOM: 'Bedroom Ceiling',
      SONOS_TARGET_HOST: '10.3.78.223',
      AUDIO_HOST_BASE_URL: 'http://arch.local:9999',
      REDDIT_AUTOMATION_SESSION_NAME: 'news-aggregator-reddit',
    });

    expect(config.app.baseUrl).toBe('http://localhost:3000');
    expect(config.briefing.timezone).toBe('America/Vancouver');
    expect(config.providers.elevenLabs.apiKey).toBe('elevenlabs-test-key');
    expect(config.browser.redditSessionName).toBe('news-aggregator-reddit');
    expect(config.sonos.targetHost).toBe('10.3.78.223');
  });

  it('throws when a required provider key is missing', () => {
    expect(() =>
      loadRuntimeConfig({
        APP_BASE_URL: 'http://localhost:3000',
        MORNING_BRIEFING_TIME: '07:00',
        MORNING_BRIEFING_TIMEZONE: 'America/Vancouver',
        XAI_API_KEY: 'xai-test-key',
        EXA_API_KEY: 'exa-test-key',
        ELEVENLABS_API_KEY: '',
        SONOS_TARGET_ROOM: 'Bedroom Ceiling',
        AUDIO_HOST_BASE_URL: 'http://arch.local:9999',
      }),
    ).toThrow(/ELEVENLABS_API_KEY/);
  });
});

describe('parseSourceRegistry', () => {
  it('returns validated source definitions', () => {
    const registry = parseSourceRegistry({
      sources: [
        {
          id: 'x-my-feed',
          name: 'My X Feed',
          type: 'social',
          fetchMethod: 'x-search',
          enabled: true,
          schedule: '*/15 * * * *',
          topics: ['ai', 'tech'],
          regions: ['global'],
          baseWeight: 0.95,
          trustWeight: 0.8,
          query: 'latest AI and tech news',
        },
      ],
    });

    expect(registry.sources).toHaveLength(1);
    expect(registry.sources[0]?.fetchMethod).toBe('x-search');
    expect(registry.sources[0]?.query).toBe('latest AI and tech news');
  });

  it('rejects invalid source definitions', () => {
    expect(() =>
      parseSourceRegistry({
        sources: [
          {
            id: 'bad-source',
            name: 'Bad Source',
            type: 'social',
            fetchMethod: 'not-real',
            enabled: true,
            schedule: '*/15 * * * *',
            topics: [],
            regions: [],
            baseWeight: 0.4,
            trustWeight: 0.2,
          },
        ],
      }),
    ).toThrow(/fetchMethod/);
  });
});
