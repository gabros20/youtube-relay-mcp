import { join } from 'node:path';
import type { FrameExtractor, ImageFormat, Resolution } from '../frame.ts';
import { frameOutputName } from '../frame.ts';
import { extractVideoId } from '../ids.ts';
import { err, ok } from '../output.ts';
import type { Envelope, Frame, FrameError, FrameResult } from '../types.ts';
import { errorMessage } from './_shared.ts';

const DEPS_HINT =
  'frame needs ffmpeg + yt-dlp on PATH — install e.g. `brew install ffmpeg yt-dlp`.';

export async function runFrame(
  extractor: FrameExtractor,
  opts: { target: string; ats: number[]; res?: Resolution; format?: ImageFormat; outDir?: string },
): Promise<Envelope<FrameResult>> {
  const id = extractVideoId(opts.target);
  if (!id) {
    return err('frame', 'INVALID_INPUT', `could not extract a video id from: ${opts.target}`);
  }
  if (opts.ats.length === 0) {
    return err('frame', 'INVALID_INPUT', 'at least one --at timestamp is required');
  }

  const format: ImageFormat = opts.format ?? 'jpg';

  const deps = await extractor.depsAvailable();
  if (!deps.ffmpeg || !deps.ytdlp) {
    const missing = [!deps.ffmpeg && 'ffmpeg', !deps.ytdlp && 'yt-dlp'].filter(Boolean).join(', ');
    return err('frame', 'MISSING_DEPENDENCY', `missing: ${missing}`, DEPS_HINT);
  }

  let url: string;
  try {
    url = await extractor.resolveStreamUrl(id, opts.res ?? 1080);
  } catch (e) {
    return err('frame', 'FETCH_FAILED', errorMessage(e));
  }

  const frames: Array<Frame | FrameError> = [];
  for (const at of opts.ats) {
    const path = join(opts.outDir ?? '.', frameOutputName(id, at, format));
    try {
      const dims = await extractor.grabFrame(url, at, path, format);
      frames.push({ at, path, width: dims.width, height: dims.height });
    } catch (e) {
      frames.push({ at, error: errorMessage(e) });
    }
  }

  return ok('frame', { id, frames });
}
