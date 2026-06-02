import { err, ok } from '../output.ts';
import type { Envelope, VideoSummary } from '../types.ts';
import type { Engine } from '../youtube.ts';
import { PROXY_HINT, errorMessage } from './_shared.ts';

export async function runSearch(
  engine: Engine,
  opts: { query: string; limit?: number },
): Promise<Envelope<VideoSummary[]>> {
  const query = opts.query.trim();
  if (!query) {
    return err('search', 'INVALID_INPUT', 'query is required');
  }

  try {
    const results = await engine.search(query, { limit: opts.limit });
    return ok('search', results);
  } catch (e) {
    return err('search', 'FETCH_FAILED', errorMessage(e), PROXY_HINT);
  }
}
