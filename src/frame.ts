/**
 * High-res frame extraction. This module is the ONLY one that shells out to
 * external binaries (yt-dlp + ffmpeg/ffprobe); the rest of the tool is pure-TS.
 */

/**
 * Parses a time expression to seconds. Accepts plain seconds ("90", "7.5"),
 * "mm:ss" / "h:mm:ss", or a millisecond suffix ("90000ms" — drops straight from
 * a transcript segment's startMs). Returns null for junk or negatives.
 */
export function parseTimeToSeconds(input: string): number | null {
  const s = input.trim();
  if (!s) return null;

  if (/^\d+ms$/.test(s)) return Number.parseInt(s, 10) / 1000;

  if (s.includes(':')) {
    const parts = s.split(':').map((p) => Number(p));
    if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }

  const n = Number(s);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export type Resolution = 720 | 1080 | 1440 | 2160 | 'max';

/** Builds the yt-dlp `-f` format string, capping height (with fallbacks) unless 'max'. */
export function ytdlpFormat(res: Resolution): string {
  if (res === 'max') return 'bestvideo/best';
  return `bestvideo[height<=${res}]/best[height<=${res}]/bestvideo/best`;
}

export type ImageFormat = 'jpg' | 'png';

/**
 * Builds ffmpeg args to grab ONE frame at `seconds`. `-ss` precedes `-i` so
 * ffmpeg range-seeks the remote stream instead of downloading it. JPEG output
 * gets a high-quality `-q:v 2`; PNG is lossless (no quality flag).
 */
export function ffmpegArgs(
  url: string,
  seconds: number,
  outPath: string,
  format: ImageFormat,
): string[] {
  const args = ['-ss', String(seconds), '-i', url, '-frames:v', '1', '-an', '-sn'];
  if (format === 'jpg') args.push('-q:v', '2');
  args.push('-y', outPath);
  return args;
}

/** Deterministic output filename: `<id>-<seconds>s.<ext>` (seconds rounded). */
export function frameOutputName(id: string, seconds: number, format: ImageFormat): string {
  return `${id}-${Math.round(seconds)}s.${format}`;
}

/**
 * Abstraction over the external binaries, injected into the command layer so
 * the command logic is testable without yt-dlp/ffmpeg installed.
 */
export interface FrameExtractor {
  depsAvailable(): Promise<{ ffmpeg: boolean; ytdlp: boolean }>;
  resolveStreamUrl(id: string, res: Resolution): Promise<string>;
  grabFrame(
    url: string,
    seconds: number,
    outPath: string,
    format: ImageFormat,
  ): Promise<{ width: number; height: number }>;
}
