/**
 * youtubei.js (InnerTube) engine wrapper.
 *
 * This is the ONLY module allowed to import youtubei.js.
 * All shape-translation is done via the exported pure normalizer functions;
 * the network methods (search / getInfo / getTranscript) are intentionally thin
 * and delegate logic to those normalizers.
 */
import { Innertube, Utils } from 'youtubei.js';

import { extractVideoId, toEmbedUrl, toWatchUrl } from './ids.ts';
import type { TranscriptResult, VideoInfo, VideoSummary } from './types.ts';

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
  // TODO: if YTRELAY_PROXY is set, wire it as the client's fetch/agent once
  // youtubei.js v17 exposes a stable proxy/fetch-override API (non-trivial to
  // wire safely across all platforms; skipped for now to avoid blocking).
  const yt = await Innertube.create();

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
      // getTranscript requires the full getInfo response, not getBasicInfo.
      const info = await yt.getInfo(id);
      try {
        const transcriptInfo = await info.getTranscript();
        const requestedLang = lang ?? transcriptInfo.selectedLanguage;
        // If a specific language is requested and it differs from the default, switch.
        const finalInfo =
          lang && lang !== transcriptInfo.selectedLanguage
            ? await transcriptInfo.selectLanguage(lang)
            : transcriptInfo;
        const segs = finalInfo.transcript?.content?.body?.initial_segments ?? [];
        return normalizeTranscript(id, segs, requestedLang ?? null);
      } catch (e: unknown) {
        // Only the known captionless cases collapse to a null+reason result.
        // A network-level / IP-block error (e.g. status 400 / 429) re-throws so
        // the command layer can emit an error envelope with a proxy hint.
        if (isNoCaptionsError(e)) {
          return noCaptionsResult(id);
        }
        throw e;
      }
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
 * Structural subset of a TranscriptSegment node.
 */
type RawSegment = {
  type?: string;
  start_ms: string;
  end_ms: string;
  snippet: { toString(): string };
};

/**
 * Maps raw transcript segments to TranscriptResult.
 */
export function normalizeTranscript(
  id: string,
  segs: unknown[],
  lang: string | null,
): TranscriptResult {
  const segments = segs.filter(isSegmentNode).map((s) => {
    const startMs = Number.parseInt(s.start_ms, 10);
    const endMs = Number.parseInt(s.end_ms, 10);
    return {
      text: s.snippet.toString(),
      startMs,
      durationMs: endMs - startMs,
    };
  });

  const transcript = segments.map((s) => s.text).join('\n');

  return {
    id,
    lang,
    source: 'innertube',
    transcript,
    segments,
  };
}

function isSegmentNode(node: unknown): node is RawSegment {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  // TranscriptSectionHeader nodes don't have start_ms — filter them out.
  return typeof n.start_ms === 'string' && typeof n.end_ms === 'string';
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

/**
 * Classifies a thrown error as a genuine "video has no captions" case
 * (true → return noCaptionsResult) vs. anything else such as a network /
 * IP-block error (false → re-throw so the command layer surfaces it).
 *
 * youtubei.js v17 throws an `InnertubeError` (exported under the `Utils`
 * namespace) for the captionless cases. The two stable messages are:
 *   - "...Video likely has no transcript." (engagement / transcript panel absent)
 *   - "Transcript continuation not found." (panel present but no segments)
 *
 * Deliberately NOT treated as no-captions: "Cannot get transcript from basic
 * video info." — that is a coding error (wrong info object) and must throw.
 */
export function isNoCaptionsError(e: unknown): boolean {
  if (!(e instanceof Utils.InnertubeError)) return false;
  const msg = e.message;
  return msg.includes('likely has no transcript') || msg === 'Transcript continuation not found.';
}
