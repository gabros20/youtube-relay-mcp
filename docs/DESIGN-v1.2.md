# v1.2 — YouTube deep-research funnel

## Goal

Turn `youtube-relay-mcp` from "search + fetch" into a **deep-research tool for
YouTube**: cast a wide, high-quality net; rank candidates cheaply on metadata
(no transcript tokens); peek before committing; read full transcripts only for
the finalists. The tool stays **atomic** — it exposes signals, filters, and
peek primitives. The **agent composes** the strategy. The **skill** teaches the
recommended funnel *and* documents every atom with its cost/signal profile.

## The cost → signal funnel (what the skill will teach)

```
GATE 1  search (cheap, broad)      → title + snippet + views + recency + verified
        rank on metadata only      → keep promising N            [NO transcript]
GATE 2  info (1 call, rich)        → full description + chapters + hasCaptions
        re-rank borderline         → shortlist                   [NO transcript]
GATE 3  transcript --head/--max    → cheap peek of finalists                 ┐
        confirm relevance/depth                                              │ small
GATE 4  transcript / context       → full read of the few that survive       ┘
```

Token discipline (explicit skill rule): **never read full transcripts during
exploration.** Use enriched search → info → transcript *peek* first.

## Verified youtubei.js facts (grounding — probed 2026-06)

- Search results already carry, for free: `view_count` ("1,819,130 views"),
  `short_view_count` ("1.8M views"), `published` ("1 year ago"),
  `author.is_verified`, a description snippet under `snippets[].text.text`, and
  `badges` (e.g. "4K"). We currently discard all of these.
- Search filters: `yt.search(q, { sort_by, upload_date, duration, features })`.
  `features: ['subtitles']` restricts to captioned videos. Confirmed working.
- Pagination: `result.getContinuation()` returns the next page (~20 more).
- No native `info.getChapters()`. Chapters parse reliably from the description's
  timestamp lines (`0:00 Introduction`, `12:42 ...`).
- Captions: `getInfo(id).captions.caption_tracks` → languages + presence.

## Locked decisions (grill)

1. **Scope:** full bundle — enriched search + filters + pagination + `info`
   (hasCaptions + chapters) + transcript peek (`--head`/`--max-chars`) +
   batch/stdin ergonomics + skill rewrite. (Cache + proxy wiring deferred to v1.3.)
2. **Captioned-only search by default** (`features: ['subtitles']`); widen with
   `--features all`. Rationale: the tool's purpose is reading transcripts.
3. **Peek primitives:** `info` chapters + `transcript --head <seconds>` +
   `transcript --max-chars <n>`.

## Surface changes (additive — non-breaking)

### `search` — enriched + filtered + paginated
```
ytrelay search "<query>" [--limit N] [--features cc|all] [--sort relevance|date|views|rating]
                         [--upload-date all|hour|today|week|month|year] [--duration any|short|medium|long]
```
- Default `--features cc` (captioned only). `--features all` widens.
- `--limit N` truly returns up to N by following continuations (capped at a
  safe page ceiling, e.g. 5 pages / ~100).
- Each result gains: `viewCount` (number|null), `viewCountText`, `published`
  (relative string|null), `verified` (bool), `descriptionSnippet` (string|null),
  `badges` (string[]). Existing fields unchanged.

### `info` — rich per-candidate detail (switches to full `getInfo`)
```
ytrelay info <id|url> [<id2> ...]
```
- Gains: `viewCount`, `published`, `verified`, `hasCaptions` (bool),
  `captionLanguages` (string[]), `chapters` ([{ title, start, startMs }]).
- `description` becomes the full description (was the short one).

### `transcript` — peek tier
```
ytrelay transcript <id|url> [<id2> ...] [--lang xx] [--format text|json]
                            [--head <seconds>] [--max-chars <n>]
```
- `--head S`: keep only segments with `startMs < S*1000` (cheap opening peek).
- `--max-chars N`: truncate the transcript string to N chars (sets `truncated:true`).
- Both compose; applied in the command layer over the full engine result.

### `context` — unchanged shape, inherits enriched `info` + chapters/hasCaptions.

### Batch + stdin (ergonomics; dodges shell word-split traps)
- `info` / `transcript` / `context` accept **multiple ids**; with >1 id the
  output is a **JSON array** of result envelopes (single id keeps the current
  single-envelope shape — back-compatible).
- If no positional ids are given, read whitespace/newline-separated ids from
  **stdin** (`… | ytrelay info`).

## Type changes (`src/types.ts`, all additive)

- `VideoSummary` += `viewCount`, `viewCountText`, `published`, `verified`,
  `descriptionSnippet`, `badges`.
- `VideoInfo` += `viewCount`, `published`, `verified`, `hasCaptions`,
  `captionLanguages`, `chapters`.
- new `Chapter = { title: string; start: string; startMs: number }`.
- `TranscriptResult` += optional `truncated?: boolean`.

## Pure helpers to add (TDD core)

- `parseViewCount(text): number | null` — "1,819,130 views" → 1819130.
- `parseChapters(description): Chapter[]` — timestamp lines → chapters.
- `applyHead(result, seconds)` / `applyMaxChars(result, n)` — transcript trims.
- Enriched `normalizeSearchResults` / `normalizeInfo` (fixture-tested).

## Engine changes (`src/youtube.ts`)

- `Engine.search(query, opts?)` opts: `{ limit?, sort?, uploadDate?, duration?, features? }`.
  Maps to youtubei.js filters; paginates via `getContinuation()` until limit.
- `getInfo` switches to `yt.getInfo` (full) to populate captions + rich fields.
- `getTranscript` unchanged (returns the full result; trimming is a command concern).

## Skill rewrite (`.claude/skills/youtube-relay/SKILL.md`)

Two layers:
1. **Recommended deep-research workflow** — the funnel above, with the
   token-discipline rule and a worked example (fan-out queries → rank on
   metadata → peek → full read).
2. **Atomic reference** — every command + flag, each tagged with a cost/signal
   profile (search = cheap/broad; info = 1 call/rich; transcript = expensive;
   `--head`/`--max-chars` = cheap peek). Plus composition notes: one id per call
   or batch/stdin; dedupe by `id` is the agent's job.

## Implementation plan (one Conventional commit per task)

- **T1 — types + pure helpers** (`parseViewCount`, `parseChapters`, transcript
  trims, `Chapter`/type additions). TDD.
- **T2 — engine**: enriched `normalizeSearchResults` + `normalizeInfo`, search
  filters + pagination, `getInfo` switch. TDD on normalizers (fixtures).
- **T3 — commands**: search opts passthrough; `transcript` `--head`/`--max-chars`;
  batch (multi-id) for info/transcript/context. TDD with FakeEngine.
- **T4 — CLI**: new flags + batch ids + stdin. TDD on parseArgs/run.
- **T5 — skill rewrite + registry + docs**; full build, live verify, npm pack,
  final review. `feat:` → semantic-release ships **v1.2.0**.

## Out of scope (v1.3)

Session cache (don't refetch an id), retry/concurrency for large fan-outs, and
wiring `YTRELAY_PROXY` for cloud/datacenter IPs.
