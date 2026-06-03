import { describe, expect, test } from 'bun:test';
import { ffmpegArgs, frameOutputName, parseTimeToSeconds, ytdlpFormat } from '../src/frame';

describe('parseTimeToSeconds', () => {
  test('plain seconds', () => {
    expect(parseTimeToSeconds('90')).toBe(90);
    expect(parseTimeToSeconds('7.5')).toBe(7.5);
  });
  test('mm:ss and h:mm:ss', () => {
    expect(parseTimeToSeconds('1:30')).toBe(90);
    expect(parseTimeToSeconds('1:02:03')).toBe(3723);
  });
  test('milliseconds suffix (drops straight from transcript startMs)', () => {
    expect(parseTimeToSeconds('90000ms')).toBe(90);
  });
  test('rejects junk', () => {
    expect(parseTimeToSeconds('')).toBeNull();
    expect(parseTimeToSeconds('soon')).toBeNull();
    expect(parseTimeToSeconds('-5')).toBeNull();
  });
});

describe('ytdlpFormat', () => {
  test('caps height with fallbacks', () => {
    expect(ytdlpFormat(1080)).toBe('bestvideo[height<=1080]/best[height<=1080]/bestvideo/best');
  });
  test('max → no height cap', () => {
    expect(ytdlpFormat('max')).toBe('bestvideo/best');
  });
});

describe('ffmpegArgs', () => {
  test('seeks before input (fast range-fetch) and writes one frame', () => {
    const args = ffmpegArgs('http://stream', 90, '/tmp/out.jpg', 'jpg');
    // -ss must come BEFORE -i for an efficient range-seek
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(args).toContain('http://stream');
    expect(args).toContain('/tmp/out.jpg');
    const ss = args[args.indexOf('-ss') + 1];
    expect(ss).toBe('90');
    expect(args).toContain('-frames:v');
  });
  test('png format omits the jpeg quality flag', () => {
    expect(ffmpegArgs('u', 1, '/o.png', 'png')).not.toContain('-q:v');
  });
});

describe('frameOutputName', () => {
  test('encodes id + whole seconds + extension', () => {
    expect(frameOutputName('dQw4w9WgXcQ', 90, 'jpg')).toBe('dQw4w9WgXcQ-90s.jpg');
  });
  test('rounds fractional seconds for the filename', () => {
    expect(frameOutputName('abc', 7.8, 'png')).toBe('abc-8s.png');
  });
});
