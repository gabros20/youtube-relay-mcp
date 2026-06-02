import { describe, expect, test } from 'bun:test';
import {
  formatDuration,
  noCaptionsResult,
  normalizeInfo,
  normalizeSearchResults,
  normalizeTranscript,
} from '../src/youtube';

const RICK = 'dQw4w9WgXcQ';
const WATCH_URL = `https://www.youtube.com/watch?v=${RICK}`;
const EMBED_URL = `https://www.youtube.com/embed/${RICK}`;

// ---------------------------------------------------------------------------
// Fixtures shaped like the real youtubei.js output (derived from probe)
// ---------------------------------------------------------------------------

/** Minimal Video node shape returned in search results */
function makeVideoNode(overrides?: {
  video_id?: string;
  title?: string;
  authorName?: string | null;
  durationText?: string | null;
  durationSeconds?: number;
}) {
  const o = {
    video_id: RICK,
    title: 'Rick Astley - Never Gonna Give You Up',
    authorName: 'Rick Astley',
    durationText: '3:34',
    durationSeconds: 214,
    ...overrides,
  };
  return {
    type: 'Video',
    video_id: o.video_id,
    title: { toString: () => o.title },
    author: o.authorName !== null ? { name: o.authorName } : null,
    duration: o.durationText !== null ? { text: o.durationText, seconds: o.durationSeconds } : null,
  };
}

/** Non-video node (e.g. shelf, ad) — should be filtered out */
function makeShelfNode() {
  return { type: 'Shelf', title: 'Related videos' };
}

/** basic_info shape from getBasicInfo / getInfo */
function makeBasicInfo(overrides?: {
  id?: string;
  title?: string;
  short_description?: string;
  author?: string;
  duration?: number;
  channel?: { id: string; name: string; url: string } | null;
}) {
  return {
    id: RICK,
    title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
    short_description: 'The official video for "Never Gonna Give You Up".',
    author: 'Rick Astley',
    duration: 213,
    channel: {
      id: 'UCuAXFkgsw1L7xaCfnd5JJOw',
      name: 'Rick Astley',
      url: 'http://www.youtube.com/@RickAstleyYT',
    },
    ...overrides,
  };
}

/** TranscriptSegment node */
function makeSegNode(startMs: number, endMs: number, text: string) {
  return {
    type: 'TranscriptSegment',
    start_ms: String(startMs),
    end_ms: String(endMs),
    snippet: { toString: () => text },
  };
}

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------
describe('formatDuration', () => {
  test('formats under 1 min', () => {
    expect(formatDuration(5)).toBe('0:05');
  });

  test('formats exactly 1 min', () => {
    expect(formatDuration(60)).toBe('1:00');
  });

  test('formats 65 seconds', () => {
    expect(formatDuration(65)).toBe('1:05');
  });

  test('formats 3661 seconds (1h1m1s)', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  test('formats exactly 1 hour', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
  });

  test('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  test('formats 59 seconds', () => {
    expect(formatDuration(59)).toBe('0:59');
  });

  test('formats 3599 seconds (59:59)', () => {
    expect(formatDuration(3599)).toBe('59:59');
  });
});

// ---------------------------------------------------------------------------
// normalizeSearchResults
// ---------------------------------------------------------------------------
describe('normalizeSearchResults', () => {
  test('maps video node fields correctly', () => {
    const results = normalizeSearchResults([makeVideoNode()], 10);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.id).toBe(RICK);
    expect(r.title).toBe('Rick Astley - Never Gonna Give You Up');
    expect(r.channel).toBe('Rick Astley');
    expect(r.duration).toBe('3:34');
    expect(r.url).toBe(WATCH_URL);
    expect(r.embedUrl).toBe(EMBED_URL);
  });

  test('builds correct url and embedUrl', () => {
    const results = normalizeSearchResults([makeVideoNode()], 10);
    expect(results[0]!.url).toBe(WATCH_URL);
    expect(results[0]!.embedUrl).toBe(EMBED_URL);
  });

  test('skips non-video nodes', () => {
    const raw = [makeShelfNode(), makeVideoNode(), makeShelfNode()];
    const results = normalizeSearchResults(raw, 10);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(RICK);
  });

  test('respects limit', () => {
    const raw = [makeVideoNode({ video_id: 'AAAAAAAAAAA', title: 'A' }), makeVideoNode()];
    const results = normalizeSearchResults(raw, 1);
    expect(results).toHaveLength(1);
  });

  test('null author -> channel null', () => {
    const r = normalizeSearchResults([makeVideoNode({ authorName: null })], 10);
    expect(r[0]!.channel).toBeNull();
  });

  test('null duration -> duration null', () => {
    const r = normalizeSearchResults([makeVideoNode({ durationText: null })], 10);
    expect(r[0]!.duration).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeInfo
// ---------------------------------------------------------------------------
describe('normalizeInfo', () => {
  test('maps all fields correctly', () => {
    const info = normalizeInfo(RICK, makeBasicInfo());
    expect(info.id).toBe(RICK);
    expect(info.title).toBe('Rick Astley - Never Gonna Give You Up (Official Video)');
    expect(info.description).toBe('The official video for "Never Gonna Give You Up".');
    expect(info.channel).toBe('Rick Astley');
    expect(info.duration).toBe('3:33'); // 213 seconds
    expect(info.url).toBe(WATCH_URL);
    expect(info.embedUrl).toBe(EMBED_URL);
  });

  test('missing short_description defaults to empty string', () => {
    const info = normalizeInfo(RICK, makeBasicInfo({ short_description: undefined }));
    expect(info.description).toBe('');
  });

  test('null channel -> channel null', () => {
    const info = normalizeInfo(RICK, makeBasicInfo({ channel: null }));
    expect(info.channel).toBeNull();
  });

  test('missing channel -> channel null regardless of author', () => {
    const info = normalizeInfo(RICK, makeBasicInfo({ channel: null, author: 'Some Author' }));
    expect(info.channel).toBeNull();
  });

  test('missing duration -> null', () => {
    const info = normalizeInfo(RICK, makeBasicInfo({ duration: undefined }));
    expect(info.duration).toBeNull();
  });

  test('channel.name is used as the channel field', () => {
    const info = normalizeInfo(RICK, makeBasicInfo());
    expect(info.channel).toBe('Rick Astley'); // from channel.name
  });
});

// ---------------------------------------------------------------------------
// normalizeTranscript
// ---------------------------------------------------------------------------
describe('normalizeTranscript', () => {
  test('joins multiple segments into full transcript text', () => {
    const segs = [
      makeSegNode(0, 3000, 'Hello'),
      makeSegNode(3000, 6000, 'world'),
      makeSegNode(6000, 9000, 'foo'),
    ];
    const r = normalizeTranscript(RICK, segs, 'en');
    expect(r.transcript).toBe('Hello\nworld\nfoo');
  });

  test('single segment produces correct text', () => {
    const r = normalizeTranscript(RICK, [makeSegNode(0, 5000, 'Just one line')], 'en');
    expect(r.transcript).toBe('Just one line');
  });

  test('segments have correct startMs and durationMs', () => {
    const segs = [makeSegNode(1000, 4500, 'Test')];
    const r = normalizeTranscript(RICK, segs, 'en');
    expect(r.segments).toHaveLength(1);
    expect(r.segments![0]!.startMs).toBe(1000);
    expect(r.segments![0]!.durationMs).toBe(3500); // 4500 - 1000
    expect(r.segments![0]!.text).toBe('Test');
  });

  test('sets source to innertube and lang correctly', () => {
    const r = normalizeTranscript(RICK, [makeSegNode(0, 1000, 'hi')], 'fr');
    expect(r.source).toBe('innertube');
    expect(r.lang).toBe('fr');
    expect(r.id).toBe(RICK);
  });

  test('empty segments array produces empty transcript', () => {
    const r = normalizeTranscript(RICK, [], 'en');
    expect(r.transcript).toBe('');
    expect(r.segments).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// noCaptionsResult
// ---------------------------------------------------------------------------
describe('noCaptionsResult', () => {
  test('returns expected null+reason shape', () => {
    const r = noCaptionsResult(RICK);
    expect(r.id).toBe(RICK);
    expect(r.lang).toBeNull();
    expect(r.source).toBeNull();
    expect(r.transcript).toBeNull();
    expect(r.reason).toBe('no captions');
  });
});
