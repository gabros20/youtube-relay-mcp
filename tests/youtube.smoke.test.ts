/**
 * Smoke tests that hit the real YouTube InnerTube API.
 *
 * These do NOT run in normal CI — they are skipped unless you set:
 *   YTRELAY_SMOKE=1 bun test tests/youtube.smoke.test.ts
 */
import { describe, expect, test } from 'bun:test';
import { createEngine } from '../src/youtube';

const RICK = 'dQw4w9WgXcQ';
const shouldRun = !!process.env.YTRELAY_SMOKE;

describe('Engine smoke tests (real network)', () => {
  test.skipIf(!shouldRun)('createEngine() returns an engine object', async () => {
    const engine = await createEngine();
    expect(engine).toBeDefined();
    expect(typeof engine.search).toBe('function');
    expect(typeof engine.getInfo).toBe('function');
    expect(typeof engine.getTranscript).toBe('function');
  });

  test.skipIf(!shouldRun)('search returns video summaries', async () => {
    const engine = await createEngine();
    const results = await engine.search('Rick Astley Never Gonna Give You Up', { limit: 3 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);
    const r = results[0]!;
    expect(r.id).toBeTruthy();
    expect(r.title).toBeTruthy();
    expect(r.url).toContain('youtube.com/watch');
    expect(r.embedUrl).toContain('youtube.com/embed');
  });

  test.skipIf(!shouldRun)('getInfo returns video metadata', async () => {
    const engine = await createEngine();
    const info = await engine.getInfo(RICK);
    expect(info.id).toBe(RICK);
    expect(info.title).toBeTruthy();
    expect(info.url).toBe(`https://www.youtube.com/watch?v=${RICK}`);
    expect(info.embedUrl).toBe(`https://www.youtube.com/embed/${RICK}`);
  });

  test.skipIf(!shouldRun)('getTranscript returns a result (with or without captions)', async () => {
    const engine = await createEngine();
    const result = await engine.getTranscript(RICK);
    expect(result.id).toBe(RICK);
    // Either we got transcript content or a graceful no-captions result
    if (result.transcript !== null) {
      expect(result.source).toBe('innertube');
      expect(result.lang).toBeTruthy();
      expect(result.segments).toBeDefined();
    } else {
      expect(result.reason).toBe('no captions');
      expect(result.source).toBeNull();
    }
  });
});
