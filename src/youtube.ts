/**
 * youtubei.js (InnerTube) engine wrapper.
 *
 * This is the ONLY module allowed to import youtubei.js.
 * All shape-translation is done via the exported pure normalizer functions;
 * the network methods (search / getInfo / getTranscript) are intentionally thin
 * and delegate logic to those normalizers.
 */
import { Innertube } from 'youtubei.js';

import { extractVideoId, toEmbedUrl, toWatchUrl } from './ids.ts';
import type { TranscriptResult, TranscriptSegment, VideoInfo, VideoSummary } from './types.ts';

// ---------------------------------------------------------------------------
// Engine interface
// ---------------------------------------------------------------------------

export interface Engine {
  search(query: string, opts?: { limit?: number }): Promise<VideoSummary[]>;
  getInfo(id: string): Promise<VideoInfo>;
  getTranscript(id: string, lang?: string): Promise<TranscriptResult>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function createEngine(): Promise<Engine> {
  // `generate_session_locally` is REQUIRED for transcripts: it makes the player
  // response return a fully-signed `timedtext` caption URL. Without it the
  // caption URL is unsigned and returns HTTP 200 with an empty body.
  const yt = await Innertube.create({ generate_session_locally: true });

  return {
    async search(query, opts) {
      const limit = opts?.limit ?? 10;
      const res = await yt.search(query);
      return normalizeSearchResults(res.results, limit);
    },

    async getInfo(input) {
      const id = resolveId(input);
      const info = await yt.getBasicInfo(id);
      return normalizeInfo(id, info.basic_info);
    },

    async getTranscript(input, lang) {
      const id = resolveId(input);
      // We deliberately AVOID youtubei.js `info.getTranscript()` — its
      // `get_transcript` InnerTube endpoint is gated by YouTube and returns
      // HTTP 400. Instead we read the signed caption-track URL from the player
      // response and fetch the `json3` timedtext directly.
      const info = await yt.getInfo(id);
      const tracks = (info.captions?.caption_tracks ?? []) as unknown as RawCaptionTrack[];
      const track = pickCaptionTrack(tracks, lang);
      if (!track) return noCaptionsResult(id);

      const url = `${track.base_url}${track.base_url.includes('?') ? '&' : '?'}fmt=json3`;
      const res = await fetch(url);
      if (!res.ok) {
        // Genuine network / IP-block failure — re-throw so the command layer
        // emits a FETCH_FAILED envelope.
        throw new Error(`Caption request failed with status ${res.status}`);
      }
      const body = await res.text();
      if (!body) return noCaptionsResult(id);

      return parseJson3Transcript(id, JSON.parse(body), track.language_code ?? lang ?? null);
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function resolveId(input: string): string {
  const id = extractVideoId(input);
  if (!id) throw new Error(`Cannot resolve a YouTube video ID from: ${JSON.stringify(input)}`);
  return id;
}

// ---------------------------------------------------------------------------
// Pure normalizers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Raw node shapes we expect from the search results array.
 * We use a structural subset so tests can pass plain objects.
 */
type RawVideoNode = {
  type: string;
  video_id: string;
  title: { toString(): string };
  author: { name: string } | null | undefined;
  duration: { text: string; seconds: number } | null | undefined;
};

/**
 * Maps library search result nodes to VideoSummary[].
 * Skips non-Video nodes; respects limit.
 */
export function normalizeSearchResults(raw: unknown[], limit: number): VideoSummary[] {
  const out: VideoSummary[] = [];
  for (const node of raw) {
    if (out.length >= limit) break;
    if (!isVideoNode(node)) continue;
    out.push({
      id: node.video_id,
      title: node.title.toString(),
      channel: node.author?.name ?? null,
      duration: node.duration?.text ?? null,
      url: toWatchUrl(node.video_id),
      embedUrl: toEmbedUrl(node.video_id),
    });
  }
  return out;
}

function isVideoNode(node: unknown): node is RawVideoNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as Record<string, unknown>).type === 'Video' &&
    typeof (node as Record<string, unknown>).video_id === 'string'
  );
}

/**
 * Shape subset of basic_info we actually read.
 */
type RawBasicInfo = {
  id?: string;
  title?: string;
  short_description?: string;
  author?: string;
  duration?: number;
  channel?: { id: string; name: string; url: string } | null;
};

/**
 * Maps basic_info to VideoInfo.
 */
export function normalizeInfo(id: string, basicInfo: RawBasicInfo): VideoInfo {
  return {
    id,
    title: basicInfo.title ?? '',
    description: basicInfo.short_description ?? '',
    channel: basicInfo.channel?.name ?? null,
    duration: basicInfo.duration != null ? formatDuration(basicInfo.duration) : null,
    url: toWatchUrl(id),
    embedUrl: toEmbedUrl(id),
  };
}

/**
 * Structural subset of a caption track from the player response.
 */
export type RawCaptionTrack = {
  base_url: string;
  language_code?: string;
  kind?: string; // 'asr' for auto-generated captions
};

/**
 * Picks the best caption track for the requested language.
 * - With `lang`: an exact `language_code` match, else a base-language match
 *   (e.g. 'en' matches 'en-US').
 * - Otherwise (or if the requested language is absent): prefer a manually
 *   authored track over an auto-generated ('asr') one, else the first track.
 * Returns undefined only when there are no tracks at all.
 */
export function pickCaptionTrack(
  tracks: RawCaptionTrack[],
  lang?: string,
): RawCaptionTrack | undefined {
  if (tracks.length === 0) return undefined;
  if (lang) {
    const want = lang.toLowerCase();
    const base = want.split('-')[0] ?? want;
    const match = tracks.find((t) => {
      const code = (t.language_code ?? '').toLowerCase();
      return code === want || (code.split('-')[0] ?? code) === base;
    });
    if (match) return match;
  }
  return tracks.find((t) => t.kind !== 'asr') ?? tracks[0];
}

/**
 * Structural subset of a json3 timedtext payload.
 */
type Json3 = {
  events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }>;
};

/**
 * Parses a json3 timedtext payload into a TranscriptResult.
 * Skips events without segments and whitespace-only lines.
 */
export function parseJson3Transcript(
  id: string,
  json3: Json3,
  lang: string | null,
): TranscriptResult {
  const segments: TranscriptSegment[] = [];
  for (const ev of json3.events ?? []) {
    if (!ev.segs) continue;
    const text = ev.segs
      .map((s) => s.utf8 ?? '')
      .join('')
      .trim();
    if (!text) continue;
    segments.push({ text, startMs: ev.tStartMs ?? 0, durationMs: ev.dDurationMs ?? 0 });
  }
  return {
    id,
    lang,
    source: 'innertube',
    transcript: segments.map((s) => s.text).join('\n'),
    segments,
  };
}

/**
 * Formats totalSeconds into h:mm:ss (when >= 3600) or m:ss.
 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const secs = s % 60;
  const mins = Math.floor(s / 60) % 60;
  const hours = Math.floor(s / 3600);

  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(mins)}:${pad(secs)}`;
  }
  return `${mins}:${pad(secs)}`;
}

/**
 * Returns the null+reason shape for a video that genuinely has no captions.
 */
export function noCaptionsResult(id: string): TranscriptResult {
  return {
    id,
    lang: null,
    source: null,
    transcript: null,
    reason: 'no captions',
  };
}
