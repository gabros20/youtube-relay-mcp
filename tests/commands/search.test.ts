import { describe, expect, test } from 'bun:test';
import { runSearch } from '../../src/commands/search.ts';
import type { VideoSummary } from '../../src/types.ts';
import { makeFakeEngine } from './fake-engine.ts';

const STUB_RESULTS: VideoSummary[] = [
  {
    id: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    channel: 'Rick Astley',
    duration: '3:33',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  },
];

describe('runSearch', () => {
  test('returns ok envelope with search results', async () => {
    const { engine } = makeFakeEngine({ searchResult: STUB_RESULTS });
    const result = await runSearch(engine, { query: 'rick astley' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command).toBe('search');
      expect(result.data).toEqual(STUB_RESULTS);
    }
  });

  test('forwards limit and filters to engine', async () => {
    const { engine, calls } = makeFakeEngine({ searchResult: [] });
    await runSearch(engine, {
      query: 'test',
      limit: 3,
      sort: 'views',
      features: 'all',
      uploadDate: 'year',
    });
    expect(calls.search[0]?.opts).toEqual({
      limit: 3,
      sort: 'views',
      features: 'all',
      uploadDate: 'year',
    });
  });

  test('empty query returns INVALID_INPUT without calling engine', async () => {
    const { engine, calls } = makeFakeEngine();
    const result = await runSearch(engine, { query: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
      expect(result.error.message).toBe('query is required');
    }
    expect(calls.search).toHaveLength(0);
  });

  test('whitespace-only query returns INVALID_INPUT without calling engine', async () => {
    const { engine, calls } = makeFakeEngine();
    const result = await runSearch(engine, { query: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
    expect(calls.search).toHaveLength(0);
  });

  test('engine throws -> FETCH_FAILED with proxy hint', async () => {
    const { engine } = makeFakeEngine({ searchThrows: new Error('network error') });
    const result = await runSearch(engine, { query: 'test' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FETCH_FAILED');
      expect(result.error.message).toContain('network error');
      expect(result.error.hint).toContain('residential');
    }
  });
});
