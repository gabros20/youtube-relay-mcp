import { describe, expect, test } from 'bun:test';
import { runFrame } from '../../src/commands/frame.ts';
import type { FrameExtractor } from '../../src/frame.ts';

function makeFakeExtractor(cfg?: {
  ffmpeg?: boolean;
  ytdlp?: boolean;
  resolveThrows?: Error;
  grabThrowsAt?: number; // throw when grabbing this `seconds`
}) {
  const calls = {
    deps: 0,
    resolve: [] as { id: string; res: unknown }[],
    grab: [] as { seconds: number; outPath: string }[],
  };
  const extractor: FrameExtractor = {
    async depsAvailable() {
      calls.deps++;
      return { ffmpeg: cfg?.ffmpeg ?? true, ytdlp: cfg?.ytdlp ?? true };
    },
    async resolveStreamUrl(id, res) {
      calls.resolve.push({ id, res });
      if (cfg?.resolveThrows) throw cfg.resolveThrows;
      return `http://stream/${id}`;
    },
    async grabFrame(_url, seconds, outPath) {
      calls.grab.push({ seconds, outPath });
      if (cfg?.grabThrowsAt === seconds) throw new Error('decode failed');
      return { width: 1920, height: 1080 };
    },
  };
  return { extractor, calls };
}

const ID = 'dQw4w9WgXcQ';

describe('runFrame', () => {
  test('extracts a frame: ok envelope with path + dimensions', async () => {
    const { extractor, calls } = makeFakeExtractor();
    const result = await runFrame(extractor, { target: ID, ats: [90] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(ID);
      expect(result.data.frames).toHaveLength(1);
      const f = result.data.frames[0] as {
        at: number;
        path: string;
        width: number;
        height: number;
      };
      expect(f.at).toBe(90);
      expect(f.path.endsWith(`${ID}-90s.jpg`)).toBe(true);
      expect(f.width).toBe(1920);
      expect(f.height).toBe(1080);
    }
    expect(calls.resolve).toHaveLength(1);
  });

  test('missing binary → MISSING_DEPENDENCY, engine not touched', async () => {
    const { extractor, calls } = makeFakeExtractor({ ffmpeg: false });
    const result = await runFrame(extractor, { target: ID, ats: [90] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_DEPENDENCY');
      expect(result.error.hint).toContain('yt-dlp');
    }
    expect(calls.resolve).toHaveLength(0);
  });

  test('invalid target → INVALID_INPUT, engine not touched', async () => {
    const { extractor, calls } = makeFakeExtractor();
    const result = await runFrame(extractor, { target: 'not-a-valid-id', ats: [90] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
    expect(calls.resolve).toHaveLength(0);
  });

  test('resolves the stream URL once for many timestamps; isolates per-frame errors', async () => {
    const { extractor, calls } = makeFakeExtractor({ grabThrowsAt: 20 });
    const result = await runFrame(extractor, { target: ID, ats: [10, 20, 30] });
    expect(result.ok).toBe(true);
    expect(calls.resolve).toHaveLength(1); // resolved ONCE
    expect(calls.grab).toHaveLength(3);
    if (result.ok) {
      expect(result.data.frames).toHaveLength(3);
      expect('path' in result.data.frames[0]!).toBe(true);
      expect('error' in result.data.frames[1]!).toBe(true); // the one that threw
      expect('path' in result.data.frames[2]!).toBe(true);
    }
  });

  test('stream URL resolution failure → FETCH_FAILED', async () => {
    const { extractor } = makeFakeExtractor({ resolveThrows: new Error('403 forbidden') });
    const result = await runFrame(extractor, { target: ID, ats: [90] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FETCH_FAILED');
  });
});
