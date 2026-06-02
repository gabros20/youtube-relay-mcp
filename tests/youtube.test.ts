import { describe, expect, test } from 'bun:test';
import {
  formatDuration,
  noCaptionsResult,
  normalizeInfo,
  normalizeSearchResults,
  parseJson3Transcript,
  pickCaptionTrack,
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
// pickCaptionTrack
// ---------------------------------------------------------------------------
describe('pickCaptionTrack', () => {
  const en = { base_url: 'u-en', language_code: 'en' };
  const enUS = { base_url: 'u-enus', language_code: 'en-US' };
  const es = { base_url: 'u-es', language_code: 'es' };
  const asrEn = { base_url: 'u-asr', language_code: 'en', kind: 'asr' };
  const manualFr = { base_url: 'u-fr', language_code: 'fr' };

  test('returns undefined for no tracks', () => {
    expect(pickCaptionTrack([], 'en')).toBeUndefined();
  });

  test('exact language_code match wins', () => {
    expect(pickCaptionTrack([en, es], 'es')?.base_url).toBe('u-es');
  });

  test('base-language match (en matches en-US)', () => {
    expect(pickCaptionTrack([enUS, es], 'en')?.base_url).toBe('u-enus');
  });

  test('no lang requested → prefers a manual track over asr', () => {
    expect(pickCaptionTrack([asrEn, manualFr])?.base_url).toBe('u-fr');
  });

  test('requested lang absent → falls back to a manual track (still returns one)', () => {
    expect(pickCaptionTrack([asrEn, manualFr], 'de')?.base_url).toBe('u-fr');
  });

  test('all asr and no lang → returns first', () => {
    const asrA = { base_url: 'a', language_code: 'en', kind: 'asr' };
    const asrB = { base_url: 'b', language_code: 'fr', kind: 'asr' };
    expect(pickCaptionTrack([asrA, asrB])?.base_url).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// parseJson3Transcript
// ---------------------------------------------------------------------------
describe('parseJson3Transcript', () => {
  const make = (events: unknown[]) => ({ events });

  test('maps events with segs to segments and joins text', () => {
    const j = make([
      { tStartMs: 0, dDurationMs: 1680, segs: [{ utf8: 'Hello' }] },
      { tStartMs: 1680, dDurationMs: 2000, segs: [{ utf8: 'world' }, { utf8: '!' }] },
    ]);
    const r = parseJson3Transcript(RICK, j, 'en');
    expect(r.transcript).toBe('Hello\nworld!');
    expect(r.segments).toHaveLength(2);
    expect(r.segments![0]!).toEqual({ text: 'Hello', startMs: 0, durationMs: 1680 });
    expect(r.segments![1]!.text).toBe('world!');
  });

  test('skips events without segs (window/format events)', () => {
    const j = make([{ tStartMs: 0 }, { tStartMs: 10, dDurationMs: 5, segs: [{ utf8: 'hi' }] }]);
    expect(parseJson3Transcript(RICK, j, 'en').segments).toHaveLength(1);
  });

  test('skips whitespace-only segments', () => {
    const j = make([
      { tStartMs: 0, dDurationMs: 5, segs: [{ utf8: '\n' }] },
      { tStartMs: 5, dDurationMs: 5, segs: [{ utf8: 'real' }] },
    ]);
    const r = parseJson3Transcript(RICK, j, 'en');
    expect(r.segments).toHaveLength(1);
    expect(r.transcript).toBe('real');
  });

  test('missing dDurationMs → durationMs 0', () => {
    const j = make([{ tStartMs: 100, segs: [{ utf8: 'x' }] }]);
    expect(parseJson3Transcript(RICK, j, 'en').segments![0]!.durationMs).toBe(0);
  });

  test('sets id, source=innertube, and lang', () => {
    const r = parseJson3Transcript(RICK, make([]), 'fr');
    expect(r.id).toBe(RICK);
    expect(r.source).toBe('innertube');
    expect(r.lang).toBe('fr');
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
