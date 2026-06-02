import { extractVideoId } from '../ids.ts';
import { err, ok } from '../output.ts';
import type { Envelope, VideoInfo } from '../types.ts';
import type { Engine } from '../youtube.ts';
import { PROXY_HINT, errorMessage } from './_shared.ts';

export async function runInfo(
  engine: Engine,
  opts: { target: string },
): Promise<Envelope<VideoInfo>> {
  const id = extractVideoId(opts.target);
  if (!id) {
    return err('info', 'INVALID_INPUT', `could not extract a video id from: ${opts.target}`);
  }

  try {
    const info = await engine.getInfo(id);
    return ok('info', info);
  } catch (e) {
    return err('info', 'FETCH_FAILED', errorMessage(e), PROXY_HINT);
  }
}
