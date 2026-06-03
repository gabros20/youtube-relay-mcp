# youtube-relay-mcp

A **deep-research tool for YouTube** for AI agents — a CLI (`ytrelay`), an MCP
server, and this skill. Cast a wide net, rank candidates cheaply on metadata,
peek before committing, and read full transcripts only for the finalists.

The tool is **atomic** (search / info / transcript / context). YOU compose the
strategy. This skill gives you the **recommended workflow** first, then a full
**reference** for each command with its cost so you can deviate intelligently.

---

## Recommended workflow (the funnel)

Use this for "find the best YouTube material on <topic>" research tasks.

**Golden rule — protect your context window:** transcripts are large. NEVER read
full transcripts during exploration. Rank on cheap metadata first; peek before a
full read; read in full only the handful that survive.

```
GATE 1 — cast a wide net (CHEAP: search)
  Run several query variants (synonyms / intent angles), dedupe by `id`.
    ytrelay search "prompt engineering" --limit 30 --sort views
    ytrelay search "how to write prompts for llms" --limit 30
  Each result already carries: title, channel, verified, viewCount, published,
  durationSeconds-as-text, descriptionSnippet, badges. Rank on THESE alone.
  Signals: authority (verified / known channel), validation (viewCount),
  recency (published — matters for fast topics), specificity (title/snippet),
  depth proxy (duration). Keep the ~10–15 most promising. NO transcript yet.

GATE 2 — enrich the shortlist (1 CALL each: info)
  ytrelay info <id1> <id2> ...        # batch — one call, array out
  Now you have full description, chapters (structure = quality signal),
  hasCaptions, viewCount. Re-rank. Drop to ~5–8. STILL no transcript.

GATE 3 — peek the finalists (CHEAP: transcript --head / --max-chars)
  ytrelay transcript <id> --head 120          # first 2 minutes
  ytrelay transcript <id> --max-chars 1500     # ~first 1500 chars
  Confirm the video actually delivers on its title before a full read.

GATE 4 — full read (EXPENSIVE: transcript / context — only the few that survive)
  ytrelay context <id>     # metadata + full transcript in one shot
```

Search is **captioned-only by default** (so everything you shortlist is
readable). Add `--features all` only when you want metadata-only breadth.

---

## Commands (atomic reference)

All commands print a JSON envelope to stdout — `{ ok, command, data }` on
success, `{ ok:false, command, error:{code,message,hint} }` on failure.
`youtubei.js` parser warnings go to **stderr** only; stdout is always clean
JSON. Exit codes: 0 ok, 1 command error, 2 unknown command.

### `search` — COST: cheap, broad. The net.
```
ytrelay search "<query>" [--limit N] [--features cc|all]
        [--sort relevance|date|views|rating] [--upload-date all|hour|today|week|month|year]
        [--duration any|short|medium|long]
```
- Captioned-only by default; `--features all` widens.
- `--limit N` follows pagination to return up to N (page ceiling ≈ 100).
- Returns `{id, title, channel, duration, url, embedUrl, viewCount, viewCountText,
  published, verified, descriptionSnippet, badges}` per result.

### `info` — COST: 1 call, rich. Re-rank the shortlist.
```
ytrelay info <id|url> [<id|url> ...]
```
- Returns `{id, title, description (full), channel, duration, url, embedUrl,
  viewCount, published, verified, hasCaptions, captionLanguages, chapters[]}`.
- `chapters` = `[{title, start, startMs}]` parsed from the description (a video
  with real chapters is usually structured, higher-quality material).
- Multiple ids → a JSON **array** of envelopes.

### `transcript` — COST: expensive (full text). Peek first.
```
ytrelay transcript <id|url> [<id|url> ...] [--lang xx] [--format text|json]
        [--head SECONDS] [--max-chars N]
```
- `--head S` keeps only the opening S seconds; `--max-chars N` caps length.
  Either sets `truncated: true`. Use these to PEEK before a full read.
- `--format json` (default) includes timestamped `segments`; `text` is the
  string only.
- No captions → `ok:true` with `transcript: null` and a `reason` (not an error).

### `context` — COST: expensive. Full read in one shot.
```
ytrelay context <id|url> [<id|url> ...] [--lang xx]
```
- Returns enriched `info` fields **plus** `transcript`. Metadata + embed are
  always returned even if the transcript is unavailable (`transcript.reason`).

### `frame` — COST: medium. SEE a moment (high-res still). Requires ffmpeg + yt-dlp.
```
ytrelay frame <id|url> --at <t> [--at <t2> ...] [--res 720|1080|1440|2160|max]
        [--format jpg|png] [--out <dir>]
```
- Extracts full-resolution still frame(s) at the given timestamp(s) and writes
  image **files**; returns `{ id, frames: [{ at, path, width, height } | { at, error }] }`.
- `--at` is repeatable and accepts seconds / `mm:ss` / `h:mm:ss` / `<n>ms`.
- **Pairs with transcript timestamps**: take a segment's `startMs`, then
  `frame --at <startMs>ms` to see exactly what was on screen. On-screen visuals
  often lag the narration, so grab a few (`--at <t> --at <t+3> --at <t+5>`) and
  pick the clearest.
- Requires **ffmpeg + yt-dlp on PATH** (the only command that does); missing →
  `MISSING_DEPENDENCY` with an install hint. Default `--res 1080`; `max` for 4K.

---

## Composition notes

- **Dedupe by `id`** across multiple `search` calls — that's your job, not the
  tool's.
- **Batch**: `info`/`transcript`/`context` take many ids in one call → array out
  (single id stays a single envelope). Or pipe ids: `... | ytrelay info -`
  (a literal `-` target reads whitespace-separated ids from stdin).
- **Embedding**: every result has `embedUrl` = `https://www.youtube.com/embed/<id>`;
  drop it straight into an `<iframe>`. `id` and watch `url` are always present.

## Error codes

- `INVALID_INPUT` — empty query / not a valid id-or-URL / bad flag. No network call.
- `FETCH_FAILED` — request to YouTube failed (video unavailable/private, or a
  datacenter-IP block — run from a residential network).
- `UNKNOWN_TOOL` / `UNKNOWN_COMMAND` — unrecognized name.
- `MISSING_DEPENDENCY` — `frame` only: ffmpeg and/or yt-dlp not on PATH (hint included).

## Install

```
npm i -g youtube-relay-mcp
```
