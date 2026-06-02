import { extractVideoId } from '../ids.ts';
import { err, ok } from '../output.ts';
import type { Envelope, TranscriptResult } from '../types.ts';
import type { Engine } from '../youtube.ts';
import { PROXY_HINT, errorMessage } from './_shared.ts';

export async function runTranscript(
  engine: Engine,
  opts: { target: string; lang?: string; format?: 'text' | 'json' },
): Promise<Envelope<TranscriptResult>> {
  const id = extractVideoId(opts.target);
  if (!id) {
    return err('transcript', 'INVALID_INPUT', `could not extract a video id from: ${opts.target}`);
  }

  try {
    const t = await engine.getTranscript(id, opts.lang);

    if (opts.format === 'text') {
      // Strip segments; keep all other fields
      const { segments: _segments, ...rest } = t;
      return ok('transcript', rest);
    }

    return ok('transcript', t);
  } catch (e) {
    return err('transcript', 'FETCH_FAILED', errorMessage(e), PROXY_HINT);
  }
}
