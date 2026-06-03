import { describe, expect, test } from 'bun:test';
import {
  buildSearchFilters,
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

/** Minimal Video node shape returned in search results (v1.2 enriched). */
function makeVideoNode(overrides?: {
  video_id?: string;
  title?: string;
  authorName?: string | null;
  verified?: boolean;
  durationText?: string | null;
  viewCountText?: string | null;
  shortViewCountText?: string | null;
  published?: string | null;
  snippet?: string | null;
  badges?: string[];
}) {
  const o = {
    video_id: RICK,
    title: 'Rick Astley - Never Gonna Give You Up',
    authorName: 'Rick Astley' as string | null,
    verified: true,
    durationText: '3:34' as string | null,
    viewCountText: '1,600,000,000 views' as string | null,
    shortViewCountText: '1.6B views' as string | null,
    published: '15 years ago' as string | null,
    snippet: 'The official video for Never Gonna Give You Up.' as string | null,
    badges: ['4K'],
    ...overrides,
  };
  return {
    type: 'Video',
    video_id: o.video_id,
    title: { toString: () => o.title },
    author: o.authorName !== null ? { name: o.authorName, is_verified: o.verified } : null,
    duration: o.durationText !== null ? { text: o.durationText } : null,
    view_count: o.viewCountText,
    short_view_count: o.shortViewCountText,
    published: o.published,
    snippets: o.snippet !== null ? [{ text: o.snippet }] : null,
    badges: o.badges.map((label) => ({ label })),
  };
}

/** Non-video node (e.g. shelf, ad) — should be filtered out */
function makeShelfNode() {
  return { type: 'Shelf', title: 'Related videos' };
}

/** Flat RawInfo shape the engine passes to normalizeInfo (v1.2). */
function makeRawInfo(
  overrides?: Partial<{
    title: string;
    description: string;
    channel: string | null;
    durationSeconds: number | null;
    viewCount: number | null;
    published: string | null;
    verified: boolean;
    captionLanguages: string[];
  }>,
) {
  return {
    title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
    description: 'The official video for "Never Gonna Give You Up".\n0:00 Intro\n1:30 The drop',
    channel: 'Rick Astley',
    durationSeconds: 213,
    viewCount: 1_600_000_000,
    published: 'Oct 25, 2009',
    verified: true,
    captionLanguages: ['en', 'es'],
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

  test('surfaces enriched quality signals', () => {
    const r = normalizeSearchResults([makeVideoNode()], 10)[0]!;
    expect(r.viewCount).toBe(1_600_000_000);
    expect(r.viewCountText).toBe('1.6B views');
    expect(r.published).toBe('15 years ago');
    expect(r.verified).toBe(true);
    expect(r.descriptionSnippet).toBe('The official video for Never Gonna Give You Up.');
    expect(r.badges).toEqual(['4K']);
  });

  test('handles missing signals (no snippet, unverified, no views)', () => {
    const node = makeVideoNode({
      verified: false,
      snippet: null,
      viewCountText: null,
      shortViewCountText: null,
      published: null,
      badges: [],
    });
    const r = normalizeSearchResults([node], 10)[0]!;
    expect(r.verified).toBe(false);
    expect(r.descriptionSnippet).toBeNull();
    expect(r.viewCount).toBeNull();
    expect(r.published).toBeNull();
    expect(r.badges).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// normalizeInfo
// ---------------------------------------------------------------------------
describe('normalizeInfo', () => {
  test('maps all fields and parses chapters from the description', () => {
    const info = normalizeInfo(RICK, makeRawInfo());
    expect(info.id).toBe(RICK);
    expect(info.title).toBe('Rick Astley - Never Gonna Give You Up (Official Video)');
    expect(info.channel).toBe('Rick Astley');
    expect(info.duration).toBe('3:33'); // 213 seconds
    expect(info.url).toBe(WATCH_URL);
    expect(info.embedUrl).toBe(EMBED_URL);
    expect(info.viewCount).toBe(1_600_000_000);
    expect(info.published).toBe('Oct 25, 2009');
    expect(info.verified).toBe(true);
    expect(info.hasCaptions).toBe(true);
    expect(info.captionLanguages).toEqual(['en', 'es']);
    expect(info.chapters).toHaveLength(2);
    expect(info.chapters[0]).toEqual({ title: 'Intro', start: '0:00', startMs: 0 });
  });

  test('empty description -> empty string and no chapters', () => {
    const info = normalizeInfo(RICK, makeRawInfo({ description: '' }));
    expect(info.description).toBe('');
    expect(info.chapters).toEqual([]);
  });

  test('null channel -> channel null', () => {
    expect(normalizeInfo(RICK, makeRawInfo({ channel: null })).channel).toBeNull();
  });

  test('null duration -> null', () => {
    expect(normalizeInfo(RICK, makeRawInfo({ durationSeconds: null })).duration).toBeNull();
  });

  test('no caption languages -> hasCaptions false', () => {
    const info = normalizeInfo(RICK, makeRawInfo({ captionLanguages: [] }));
    expect(info.hasCaptions).toBe(false);
    expect(info.captionLanguages).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildSearchFilters
// ---------------------------------------------------------------------------
describe('buildSearchFilters', () => {
  test('defaults to captioned-only (subtitles)', () => {
    expect(buildSearchFilters()).toEqual({ features: ['subtitles'] });
    expect(buildSearchFilters({ limit: 50 })).toEqual({ features: ['subtitles'] });
  });

  test('features:all drops the subtitles filter', () => {
    expect(buildSearchFilters({ features: 'all' }).features).toBeUndefined();
  });

  test('maps sort aliases', () => {
    expect(buildSearchFilters({ sort: 'views' }).sort_by).toBe('view_count');
    expect(buildSearchFilters({ sort: 'date' }).sort_by).toBe('upload_date');
    expect(buildSearchFilters({ sort: 'relevance' }).sort_by).toBe('relevance');
  });

  test('passes uploadDate/duration through, omitting all/any', () => {
    const f = buildSearchFilters({ uploadDate: 'year', duration: 'long', features: 'all' });
    expect(f.upload_date).toBe('year');
    expect(f.duration).toBe('long');
    expect(buildSearchFilters({ uploadDate: 'all', duration: 'any' }).upload_date).toBeUndefined();
    expect(buildSearchFilters({ duration: 'any' }).duration).toBeUndefined();
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
