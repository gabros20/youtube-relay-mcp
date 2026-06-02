# youtube-relay-mcp

A code-execution YouTube tool for AI agents. Wraps `youtubei.js` to **search YouTube**, **fetch video metadata** (title, description, channel, duration), and return an **embeddable video ID/URL**. Usable as a CLI (`ytrelay`), an MCP server, or a Claude Code skill.

## When to use

Use this when you need to find YouTube videos, pull a video's title/description, or get a clean embeddable video ID/URL to render or cite a video.

## Status / what works today

- ✅ **search** — works.
- ✅ **info** — title, description, channel, duration, embeddable id — works.
- ✅ **context** — returns the full metadata + embed for a video (the transcript portion is currently degraded, see below) — works.
- ⚠️ **transcript** — **known limitation.** YouTube now requires a PO token on its transcript endpoint, so the bundled `youtubei.js` engine returns an error (HTTP 400 / empty) even from a residential IP. The command exists and degrades gracefully (clean error + hint), but does not return transcript text yet. A pure-TS transcript backend is planned. **Do not rely on transcript output for now** — use `search`/`info`/`context` for metadata and embedding.

## Install

```
npm i -g youtube-relay-mcp
```

After installation the `ytrelay` binary is available globally. Requests work best from a normal (residential) network; datacenter/cloud IPs are more likely to be blocked by YouTube.

## Commands

All commands print a JSON envelope to stdout (`{ ok, command, data }` on success, `{ ok:false, command, error }` on failure). Library/parser warnings from `youtubei.js` go to **stderr** only — stdout is always clean JSON. Exit code: 0 on success, 1 on a command error, 2 on an unknown command.

---

### search

```
ytrelay search "<query>" [--limit N]
```

- `--limit N` — maximum number of results (default 5).

```
ytrelay search "bun runtime intro" --limit 3
```

```json
{
  "ok": true,
  "command": "search",
  "data": [
    {
      "id": "dQw4w9WgXcQ",
      "title": "Never Gonna Give You Up",
      "channel": "Rick Astley",
      "duration": "3:33",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ"
    }
  ]
}
```

`channel` and `duration` may be `null` for some result types.

---

### info

```
ytrelay info <id|url>
```

Accepts a bare 11-char id or any YouTube URL form (`watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`).

```
ytrelay info https://youtu.be/dQw4w9WgXcQ
```

```json
{
  "ok": true,
  "command": "info",
  "data": {
    "id": "dQw4w9WgXcQ",
    "title": "Never Gonna Give You Up",
    "description": "The official video for ...",
    "channel": "Rick Astley",
    "duration": "3:33",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ"
  }
}
```

---

### context — the primary command

Fetch metadata + transcript together in one call. Even when the transcript is unavailable (current limitation), this still returns full metadata and the embed URL — the transcript object carries a `reason`.

```
ytrelay context <id|url> [--lang xx]
```

- `--lang xx` — preferred caption language (BCP-47), when transcripts are available.

```json
{
  "ok": true,
  "command": "context",
  "data": {
    "id": "dQw4w9WgXcQ",
    "title": "Never Gonna Give You Up",
    "description": "...",
    "channel": "Rick Astley",
    "duration": "3:33",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "transcript": {
      "id": "dQw4w9WgXcQ",
      "lang": null,
      "source": null,
      "transcript": null,
      "reason": "transcript unavailable (known limitation — YouTube requires a PO token): ..."
    }
  }
}
```

When transcripts work, `transcript.transcript` is the text, `transcript.source` is `"innertube"`, and `transcript.lang` is set.

---

### transcript (known limitation — see Status)

```
ytrelay transcript <id|url> [--lang xx] [--format text|json]
```

- `--lang xx` — preferred caption language (BCP-47).
- `--format text|json` — `json` (default) includes a `segments` array (`{ text, startMs, durationMs }`); `text` returns the transcript string only (omits `segments`).

Currently returns a `FETCH_FAILED` error (PO-token limitation). Intended success shape:

```json
{
  "ok": true,
  "command": "transcript",
  "data": {
    "id": "dQw4w9WgXcQ",
    "lang": "en",
    "source": "innertube",
    "transcript": "Never gonna give you up ...",
    "segments": [{ "text": "Never gonna give you up", "startMs": 18400, "durationMs": 2000 }]
  }
}
```

---

## Embed rule

Every video result includes `embedUrl` in the form `https://www.youtube.com/embed/<id>`. Use it directly in an `<iframe>` or any embed-accepting surface. The bare `id` and the watch `url` are also always provided.

## Error envelope

```json
{
  "ok": false,
  "command": "transcript",
  "error": {
    "code": "FETCH_FAILED",
    "message": "Request to .../get_transcript ... failed with status code 400",
    "hint": "Transcript fetching is a known limitation (YouTube requires a PO token ...) — search, info, and metadata work normally."
  }
}
```

Error codes:
- `INVALID_INPUT` — empty query, or a target that isn't a valid YouTube id/URL. No network call is made.
- `FETCH_FAILED` — the request to YouTube failed. For `search`/`info` this usually means a network/IP block (run from a residential network); for `transcript`/`context` it is the PO-token limitation above.
- `UNKNOWN_TOOL` / `UNKNOWN_COMMAND` — the tool/command name isn't recognized.

## Failure modes

- **Transcript PO-token wall** — transcript text is currently unavailable (see Status); `info`/`search`/`context` metadata are unaffected.
- **Cloud/sandbox IP block** — from a datacenter IP, YouTube may block even search/info; run from a residential network. (A built-in proxy option is planned, not yet wired.)
- **Invalid id or URL** — returns `INVALID_INPUT` before any network call.
