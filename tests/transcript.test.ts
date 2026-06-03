import { describe, expect, test } from 'bun:test';
import { applyHead, applyMaxChars } from '../src/transcript';
import type { TranscriptResult } from '../src/types';

const base: TranscriptResult = {
  id: 'x',
  lang: 'en',
  source: 'innertube',
  transcript: 'aaaa\nbbbb\ncccc',
  segments: [
    { text: 'aaaa', startMs: 0, durationMs: 1000 },
    { text: 'bbbb', startMs: 5000, durationMs: 1000 },
    { text: 'cccc', startMs: 60000, durationMs: 1000 },
  ],
};

describe('applyHead', () => {
  test('keeps only segments before the cutoff and rebuilds text', () => {
    const r = applyHead(base, 10); // 10s → keeps startMs < 10000 (aaaa, bbbb)
    expect(r.segments).toHaveLength(2);
    expect(r.transcript).toBe('aaaa\nbbbb');
    expect(r.truncated).toBe(true);
  });
  test('no truncation when cutoff covers everything', () => {
    const r = applyHead(base, 120);
    expect(r.segments).toHaveLength(3);
    expect(r.truncated).toBeUndefined();
  });
  test('null transcript (no captions) passes through unchanged', () => {
    const none: TranscriptResult = { id: 'x', lang: null, source: null, transcript: null };
    expect(applyHead(none, 10)).toEqual(none);
  });
});

describe('applyMaxChars', () => {
  test('keeps whole segments up to the char budget', () => {
    const r = applyMaxChars(base, 9); // 'aaaa'(4) + '\n'+'bbbb'(5) = 9 ok; next would exceed
    expect(r.transcript).toBe('aaaa\nbbbb');
    expect(r.segments).toHaveLength(2);
    expect(r.truncated).toBe(true);
  });
  test('no truncation when under budget', () => {
    const r = applyMaxChars(base, 1000);
    expect(r.transcript).toBe('aaaa\nbbbb\ncccc');
    expect(r.truncated).toBeUndefined();
  });
  test('slices a segmentless transcript string', () => {
    const noSegs: TranscriptResult = {
      id: 'x',
      lang: 'en',
      source: 'innertube',
      transcript: 'hello world',
    };
    const r = applyMaxChars(noSegs, 5);
    expect(r.transcript).toBe('hello');
    expect(r.truncated).toBe(true);
  });
});
