import { describe, expect, test } from 'bun:test';
import { err, ok, toJson } from '../src/output';

describe('ok', () => {
  test('returns envelope with ok: true and correct shape', () => {
    const result = ok('search', { hits: 3 });
    expect(result.ok).toBe(true);
    expect(result.command).toBe('search');
    expect(result.data).toEqual({ hits: 3 });
  });
});

describe('err', () => {
  test('returns envelope with ok: false and correct shape', () => {
    const result = err('info', 'NOT_FOUND', 'Video not found');
    expect(result.ok).toBe(false);
    expect(result.command).toBe('info');
    expect(result.error.code).toBe('NOT_FOUND');
    expect(result.error.message).toBe('Video not found');
  });

  test('includes hint when provided', () => {
    const result = err('transcript', 'NO_CAPTIONS', 'No captions', 'Try a different language');
    expect(result.error.hint).toBe('Try a different language');
  });

  test('does NOT include hint key when hint is omitted', () => {
    const result = err('info', 'NOT_FOUND', 'Video not found');
    expect('hint' in result.error).toBe(false);
  });
});

describe('toJson', () => {
  test('serializes envelope to pretty JSON that parses back identically', () => {
    const envelope = ok('search', { q: 'test' });
    const json = toJson(envelope);
    expect(JSON.parse(json)).toEqual(envelope);
  });

  test('uses 2-space indentation', () => {
    const envelope = ok('test', { x: 1 });
    const json = toJson(envelope);
    expect(json).toContain('  ');
  });
});
