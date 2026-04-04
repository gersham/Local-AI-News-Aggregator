import type { DotenvConfigOutput } from 'dotenv';
import { describe, expect, it, vi } from 'vitest';
import {
  buildNextProcessEnv,
  getRootEnvPath,
  getWebAppPath,
  loadRootEnvConfig,
} from './run-next';

describe('run-next helpers', () => {
  it('resolves the repo root .env from the web scripts directory', () => {
    expect(
      getRootEnvPath(
        '/Users/gersham/Sources/personal/NewsAggregator/apps/web/scripts',
      ),
    ).toBe('/Users/gersham/Sources/personal/NewsAggregator/.env');
    expect(
      getWebAppPath(
        '/Users/gersham/Sources/personal/NewsAggregator/apps/web/scripts',
      ),
    ).toBe('/Users/gersham/Sources/personal/NewsAggregator/apps/web');
  });

  it('loads the root env file through dotenv config', () => {
    const loadEnv = vi.fn();
    const processEnv = {};

    loadRootEnvConfig(
      '/Users/gersham/Sources/personal/NewsAggregator/apps/web/scripts',
      loadEnv,
      processEnv,
    );

    expect(loadEnv).toHaveBeenCalledWith({
      path: '/Users/gersham/Sources/personal/NewsAggregator/.env',
      processEnv,
      quiet: true,
    });
  });

  it('drops NODE_ENV from the loaded root env while keeping other values', () => {
    const loadEnv = vi.fn(
      (_options): DotenvConfigOutput => ({
        parsed: {
          MONGODB_URI: 'mongodb://localhost:27017',
          NODE_ENV: 'development',
        },
      }),
    );

    const result = buildNextProcessEnv(
      '/Users/gersham/Sources/personal/NewsAggregator/apps/web/scripts',
      loadEnv,
      {
        PATH: '/usr/bin',
      },
    );

    expect(result.MONGODB_URI).toBe('mongodb://localhost:27017');
    expect(result.NODE_ENV).toBeUndefined();
    expect(result.PATH).toBe('/usr/bin');
    expect(loadEnv).toHaveBeenCalledWith({
      path: '/Users/gersham/Sources/personal/NewsAggregator/.env',
      processEnv: result,
      quiet: true,
    });
  });
});
