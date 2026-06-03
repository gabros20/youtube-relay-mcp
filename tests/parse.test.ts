import { describe, expect, test } from 'bun:test';
import { parseChapters, parseViewCount } from '../src/parse';

describe('parseViewCount', () => {
  test('parses a comma-grouped full count', () => {
    expect(parseViewCount('1,819,130 views')).toBe(1819130);
  });
  test('parses a compact count with M/K suffix', () => {
    expect(parseViewCount('1.8M views')).toBe(1800000);
    expect(parseViewCount('12K views')).toBe(12000);
    expect(parseViewCount('2B views')).toBe(2000000000);
  });
  test('parses a plain small count', () => {
    expect(parseViewCount('523 views')).toBe(523);
  });
  test('returns null when there is no number', () => {
    expect(parseViewCount('No views')).toBeNull();
    expect(parseViewCount('')).toBeNull();
    expect(parseViewCount(null)).toBeNull();
  });
});

describe('parseChapters', () => {
  test('extracts timestamped lines as chapters with correct startMs', () => {
    const desc = '0:00 Intro\n1:30 Part one\n12:42 Deep dive\njust a normal line';
    const ch = parseChapters(desc);
    expect(ch).toHaveLength(3);
    expect(ch[0]).toEqual({ title: 'Intro', start: '0:00', startMs: 0 });
    expect(ch[1]!.startMs).toBe(90_000); // 1:30
    expect(ch[2]!.startMs).toBe(762_000); // 12:42
  });
  test('handles h:mm:ss timestamps', () => {
    expect(parseChapters('1:02:03 Long section')[0]!.startMs).toBe(3_723_000);
  });
  test('ignores timestamps that are not at the start of a line', () => {
    expect(parseChapters('see 1:30 for details')).toHaveLength(0);
  });
  test('returns empty array when there are no chapters', () => {
    expect(parseChapters('No timestamps here at all.')).toEqual([]);
    expect(parseChapters('')).toEqual([]);
  });
});
