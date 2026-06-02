import { describe, expect, test } from 'bun:test';
import { extractVideoId, toEmbedUrl, toWatchUrl } from '../src/ids';

const RICK = 'dQw4w9WgXcQ';

describe('extractVideoId', () => {
  test('accepts a bare 11-char id', () => {
    expect(extractVideoId(RICK)).toBe(RICK);
  });

  test('extracts id from standard watch URL', () => {
    expect(extractVideoId(`https://www.youtube.com/watch?v=${RICK}`)).toBe(RICK);
  });

  test('extracts id from watch URL with extra params', () => {
    expect(extractVideoId(`https://www.youtube.com/watch?v=${RICK}&t=30s`)).toBe(RICK);
  });

  test('extracts id from youtu.be short link', () => {
    expect(extractVideoId(`https://youtu.be/${RICK}`)).toBe(RICK);
  });

  test('extracts id from youtu.be short link with si param', () => {
    expect(extractVideoId(`https://youtu.be/${RICK}?si=xyz`)).toBe(RICK);
  });

  test('extracts id from embed URL', () => {
    expect(extractVideoId(`https://www.youtube.com/embed/${RICK}`)).toBe(RICK);
  });

  test('extracts id from shorts URL', () => {
    expect(extractVideoId(`https://www.youtube.com/shorts/${RICK}`)).toBe(RICK);
  });

  test('extracts id from mobile watch URL', () => {
    expect(extractVideoId(`https://m.youtube.com/watch?v=${RICK}`)).toBe(RICK);
  });

  test('returns null for empty string', () => {
    expect(extractVideoId('')).toBeNull();
  });

  test('returns null for non-URL garbage string', () => {
    expect(extractVideoId('not-a-url')).toBeNull();
  });

  test('returns null for too-short value', () => {
    expect(extractVideoId('abc')).toBeNull();
  });

  test('returns null for 11-char string with invalid chars', () => {
    expect(extractVideoId('hello world')).toBeNull();
  });
});

describe('toWatchUrl', () => {
  test('produces the exact expected watch URL', () => {
    expect(toWatchUrl(RICK)).toBe(`https://www.youtube.com/watch?v=${RICK}`);
  });
});

describe('toEmbedUrl', () => {
  test('produces the exact expected embed URL', () => {
    expect(toEmbedUrl(RICK)).toBe(`https://www.youtube.com/embed/${RICK}`);
  });
});
