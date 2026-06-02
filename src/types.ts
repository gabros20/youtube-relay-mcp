export type VideoSummary = {
  id: string;
  title: string;
  channel: string | null;
  duration: string | null;
  url: string;
  embedUrl: string;
};

export type VideoInfo = {
  id: string;
  title: string;
  description: string;
  channel: string | null;
  duration: string | null;
  url: string;
  embedUrl: string;
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
};

export type ContextResult = VideoInfo & { transcript: TranscriptResult };

export type Ok<T> = { ok: true; command: string; data: T };
export type Err = {
  ok: false;
  command: string;
  error: { code: string; message: string; hint?: string };
};
export type Envelope<T> = Ok<T> | Err;
