export type VideoSummary = {
  id: string;
  title: string;
  channel: string | null;
  duration: string | null;
  url: string;
  embedUrl: string;
  // Cheap quality/relevance signals surfaced from the search response (v1.2).
  viewCount: number | null;
  viewCountText: string | null;
  published: string | null;
  verified: boolean;
  descriptionSnippet: string | null;
  badges: string[];
};

export type Chapter = {
  title: string;
  start: string; // human timestamp, e.g. "12:42"
  startMs: number;
};

export type VideoInfo = {
  id: string;
  title: string;
  description: string;
  channel: string | null;
  duration: string | null;
  url: string;
  embedUrl: string;
  // Enriched detail signals (v1.2).
  viewCount: number | null;
  published: string | null;
  verified: boolean;
  hasCaptions: boolean;
  captionLanguages: string[];
  chapters: Chapter[];
};

export type TranscriptSegment = {
  text: string;
  startMs: number;
  durationMs: number;
};

export type TranscriptResult = {
  id: string;
  lang: string | null;
  source: 'innertube' | null;
  transcript: string | null;
  segments?: TranscriptSegment[];
  reason?: string;
  truncated?: boolean;
};

export type ContextResult = VideoInfo & { transcript: TranscriptResult };

export type Ok<T> = { ok: true; command: string; data: T };
export type Err = {
  ok: false;
  command: string;
  error: { code: string; message: string; hint?: string };
};
export type Envelope<T> = Ok<T> | Err;
