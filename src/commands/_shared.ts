export const PROXY_HINT =
  'If running in a cloud sandbox, YouTube may block datacenter IPs — set YTRELAY_PROXY to a residential proxy.';

// Transcript fetching is a known limitation: YouTube's get_transcript endpoint
// and timedtext caption URLs now require a PO token, so the bundled youtubei.js
// engine returns HTTP 400 / empty even from a residential IP. Search, info, and
// video metadata are unaffected. A pure-TS transcript backend is planned.
export const TRANSCRIPT_HINT =
  'Transcript fetching is a known limitation (YouTube requires a PO token on the transcript endpoint) — search, info, and metadata work normally. A pure-TS transcript backend is planned.';

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
