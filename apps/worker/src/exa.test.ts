import {
  loadCachedArticlesFromMongo,
  saveCachedArticlesToMongo,
} from '@news-aggregator/core';
import { createMongoTestContext } from '@news-aggregator/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { fetchExaContents, searchExa } from './exa';

describe('searchExa', () => {
  it('constrains topic discovery searches to the last 24 hours by default', async () => {
    const fetchMock = vi.fn(
      async (
        _input: string | URL | Request,
        _init?: RequestInit,
      ): Promise<Response> =>
        new Response(
          JSON.stringify({
            requestId: 'exa_req_123',
            results: [],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        ),
    );

    await searchExa('latest bc news', {
      apiKey: 'exa-test-key',
      fetchImplementation: fetchMock,
      now: new Date('2026-04-04T20:00:00.000Z'),
    });

    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));

    expect(body).toMatchObject({
      contents: {
        filterEmptyResults: true,
        highlights: {
          maxCharacters: 2000,
          query: 'latest bc news',
        },
        livecrawlTimeout: 12000,
        maxAgeHours: 24,
        summary: {
          maxTokens: 220,
          query: 'latest bc news',
        },
        text: {
          excludeSections: ['navigation', 'banner', 'sidebar', 'footer'],
          includeSections: ['body', 'metadata'],
          maxCharacters: 12000,
          verbosity: 'standard',
        },
      },
      endPublishedDate: '2026-04-04T20:00:00.000Z',
      query: 'latest bc news',
      startPublishedDate: '2026-04-03T20:00:00.000Z',
      type: 'auto',
    });
  });

  it('supports richer Exa discovery controls for news search', async () => {
    const fetchMock = vi.fn(
      async (
        _input: string | URL | Request,
        _init?: RequestInit,
      ): Promise<Response> =>
        new Response(
          JSON.stringify({
            requestId: 'exa_req_456',
            results: [],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        ),
    );

    await searchExa('latest British Columbia Vancouver Canada news', {
      additionalQueries: ['breaking news British Columbia today'],
      apiKey: 'exa-test-key',
      category: 'news',
      excludeDomains: ['facebook.com'],
      fetchImplementation: fetchMock,
      includeDomains: ['cbc.ca', 'ctvnews.ca'],
      numResults: 25,
      searchType: 'deep',
      userLocation: 'ca',
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));

    expect(body).toMatchObject({
      additionalQueries: ['breaking news British Columbia today'],
      category: 'news',
      excludeDomains: ['facebook.com'],
      includeDomains: ['cbc.ca', 'ctvnews.ca'],
      numResults: 25,
      query: 'latest British Columbia Vancouver Canada news',
      type: 'deep',
      userLocation: 'ca',
    });
  });

  it('retries rate-limited search requests using Retry-After', async () => {
    const fetchMock = vi
      .fn<
        (input: string | URL | Request, init?: RequestInit) => Promise<Response>
      >()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'rate limited',
          }),
          {
            status: 429,
            headers: {
              'content-type': 'application/json',
              'retry-after': '0',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            requestId: 'exa_req_retry',
            results: [],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        ),
      );
    const sleepMock = vi.fn(async (_ms: number) => undefined);

    const result = await searchExa('latest bc news', {
      apiKey: 'exa-test-key',
      fetchImplementation: fetchMock,
      sleepImplementation: sleepMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledWith(0);
    expect(result.requestId).toBe('exa_req_retry');
  });
});

describe('fetchExaContents', () => {
  it('requests fresh article text using livecrawl always for cleaner body extraction', async () => {
    const fetchMock = vi.fn(
      async (
        _input: string | URL | Request,
        _init?: RequestInit,
      ): Promise<Response> =>
        new Response(
          JSON.stringify({
            requestId: 'exa_contents_123',
            results: [],
            statuses: [],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        ),
    );

    await fetchExaContents(['https://example.com/story'], {
      apiKey: 'exa-test-key',
      fetchImplementation: fetchMock,
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));

    expect(body).toMatchObject({
      filterEmptyResults: true,
      ids: ['https://example.com/story'],
      livecrawl: 'always',
      livecrawlTimeout: 12000,
      summary: {
        maxTokens: 220,
      },
      text: {
        excludeSections: ['navigation', 'banner', 'sidebar', 'footer'],
        includeSections: ['body', 'metadata'],
        maxCharacters: 24000,
        verbosity: 'standard',
      },
    });
    expect(body).not.toHaveProperty('maxAgeHours');
  });

  it('retries rate-limited contents requests using a bounded backoff', async () => {
    const fetchMock = vi
      .fn<
        (input: string | URL | Request, init?: RequestInit) => Promise<Response>
      >()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'rate limited',
          }),
          {
            status: 429,
            headers: {
              'content-type': 'application/json',
              'retry-after': '0',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            requestId: 'exa_contents_retry',
            results: [],
            statuses: [],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        ),
      );
    const sleepMock = vi.fn(async (_ms: number) => undefined);

    const result = await fetchExaContents(['https://example.com/story'], {
      apiKey: 'exa-test-key',
      fetchImplementation: fetchMock,
      sleepImplementation: sleepMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledWith(0);
    expect(result.requestId).toBe('exa_contents_retry');
  });

  it('batches contents lookups for larger URL sets', async () => {
    const fetchMock = vi.fn(
      async (
        _input: string | URL | Request,
        _init?: RequestInit,
      ): Promise<Response> =>
        new Response(
          JSON.stringify({
            requestId: 'exa_contents_batch',
            results: [],
            statuses: [],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        ),
    );
    const urls = Array.from({ length: 21 }, (_, index) => {
      return `https://example.com/story-${index + 1}`;
    });

    await fetchExaContents(urls, {
      apiKey: 'exa-test-key',
      fetchImplementation: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

    expect(firstBody.ids).toHaveLength(20);
    expect(secondBody.ids).toHaveLength(1);
  });

  it('checks MongoDB article cache before fetching misses from Exa and stores fresh results', async () => {
    const mongo = await createMongoTestContext();

    await saveCachedArticlesToMongo(
      [
        {
          publishedDate: '2026-04-04T09:00:00.000Z',
          summary: 'Cached summary.',
          text: 'Cached body text.',
          title: 'Cached article',
          url: 'https://example.com/story-1?utm_source=exa',
        },
      ],
      {
        client: mongo.client,
        dbName: mongo.dbName,
      },
    );

    const fetchMock = vi.fn(
      async (
        _input: string | URL | Request,
        _init?: RequestInit,
      ): Promise<Response> =>
        new Response(
          JSON.stringify({
            requestId: 'exa_contents_cached',
            results: [
              {
                publishedDate: '2026-04-04T10:00:00.000Z',
                summary: 'Fresh summary.',
                text: 'Fresh body text.',
                title: 'Fresh article',
                url: 'https://example.com/story-2',
              },
            ],
            statuses: [
              {
                id: 'https://example.com/story-2',
                status: 'success',
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        ),
    );

    const result = await fetchExaContents(
      ['https://example.com/story-1', 'https://example.com/story-2'],
      {
        apiKey: 'exa-test-key',
        cache: {
          client: mongo.client,
          dbName: mongo.dbName,
        },
        fetchImplementation: fetchMock,
      },
    );

    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));

    expect(body.ids).toEqual(['https://example.com/story-2']);
    expect(result.results).toHaveLength(2);
    expect(
      result.results?.find(
        (entry) => entry.url === 'https://example.com/story-1',
      )?.text,
    ).toBe('Cached body text.');
    expect(
      result.statuses?.find(
        (entry) => entry.id === 'https://example.com/story-1',
      )?.status,
    ).toBe('cached');

    const cacheState = await loadCachedArticlesFromMongo(
      ['https://example.com/story-2'],
      {
        client: mongo.client,
        dbName: mongo.dbName,
      },
    );

    expect(cacheState.hits).toHaveLength(1);
    expect(cacheState.hits[0]?.text).toBe('Fresh body text.');

    await mongo.cleanup();
  }, 15000);
});
