import { extractVideoId } from '../ids.ts';
import { err, ok } from '../output.ts';
import type { ContextResult, Envelope, TranscriptResult, VideoInfo } from '../types.ts';
import type { Engine } from '../youtube.ts';
import { PROXY_HINT, errorMessage } from './_shared.ts';

export async function runContext(
  engine: Engine,
  opts: { target: string; lang?: string },
): Promise<Envelope<ContextResult>> {
  const id = extractVideoId(opts.target);
  if (!id) {
    return err('context', 'INVALID_INPUT', `could not extract a video id from: ${opts.target}`);
  }

  let info: VideoInfo;
  try {
    info = await engine.getInfo(id);
  } catch (e) {
    return err('context', 'FETCH_FAILED', errorMessage(e), PROXY_HINT);
  }

  let transcript: TranscriptResult;
  try {
    transcript = await engine.getTranscript(id, opts.lang);
  } catch (e) {
    transcript = {
      id,
      lang: null,
      source: null,
      transcript: null,
      reason: `transcript unavailable (known limitation — YouTube requires a PO token): ${errorMessage(e)}`,
    };
  }

  return ok('context', { ...info, transcript });
}
