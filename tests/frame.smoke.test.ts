import { describe, expect, test } from 'bun:test';
// Real frame-extraction smoke test. Hits the network and requires ffmpeg + yt-dlp.
// Skipped in CI; run with:  YTRELAY_SMOKE=1 bun test tests/frame.smoke.test.ts
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFrame } from '../src/commands/frame.ts';
import { createFrameExtractor } from '../src/frame.ts';

const shouldRun = !!process.env.YTRELAY_SMOKE;

describe('frame smoke (real ffmpeg + yt-dlp)', () => {
  test.skipIf(!shouldRun)(
    'extracts a readable 1080p frame at a timestamp',
    async () => {
      const outDir = join(tmpdir(), `ytrelay-smoke-${process.pid}`);
      const extractor = createFrameExtractor();
      const result = await runFrame(extractor, {
        target: 'dQw4w9WgXcQ',
        ats: [90],
        res: 1080,
        outDir,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const f = result.data.frames[0] as { path: string; width: number; height: number };
        expect(existsSync(f.path)).toBe(true);
        expect(f.width).toBeGreaterThan(640);
        expect(f.height).toBeGreaterThan(360);
      }
      rmSync(outDir, { recursive: true, force: true });
    },
    60_000,
  );
});
