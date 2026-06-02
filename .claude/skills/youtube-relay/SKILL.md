# youtube-relay-mcp

A code-execution YouTube tool for AI agents. Wraps `youtubei.js` to search YouTube, fetch video metadata and transcripts, and return embeddable video IDs. Designed for use as a CLI, an MCP tool, or a Claude Code skill.

## Install

```
npm i -g youtube-relay-mcp
```

After installation the `ytrelay` binary is available globally.

## Commands

All commands print a JSON envelope to stdout. Exit code is 0 on success, 1 on error.

---

### search

Search YouTube and return a list of video summaries.

```
ytrelay search "<query>" [--limit N]
```

**Options**
- `--limit N` — maximum number of results (default: 5)

**Example**
```
ytrelay search "bun runtime intro" --limit 3
```

**Response envelope**
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

---

### info

Fetch title, description, channel, and duration for a single video.

```
ytrelay info <id|url>
```

**Example**
```
ytrelay info dQw4w9WgXcQ
```

**Response envelope**
```json
{
  "ok": true,
  "command": "info",
  "data": {
    "id": "dQw4w9WgXcQ",
    "title": "Never Gonna Give You Up",
    "description": "The official video for \"Never Gonna Give You Up\" ...",
    "channel": "Rick Astley",
    "duration": "3:33",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ"
  }
}
```

---

### transcript

Fetch the transcript for a video, optionally in a specific language and format.

```
ytrelay transcript <id|url> [--lang xx] [--format text|json]
```

**Options**
- `--lang xx` — BCP-47 language code for the caption track (default: auto)
- `--format text|json` — plain concatenated text or JSON segments with timestamps (default: text)

**Example**
```
ytrelay transcript dQw4w9WgXcQ --lang en --format json
```

**Response envelope**
```json
{
  "ok": true,
  "command": "transcript",
  "data": {
    "id": "dQw4w9WgXcQ",
    "lang": "en",
    "source": "innertube",
    "transcript": "Never gonna give you up ...",
    "segments": [
      { "text": "Never gonna give you up", "startMs": 18400, "durationMs": 2000 }
    ]
  }
}
```

---

### context

Fetch video info and transcript together in a single call.

```
ytrelay context <id|url> [--lang xx]
```

**Options**
- `--lang xx` — BCP-47 language code for the caption track (default: auto)

**Example**
```
ytrelay context dQw4w9WgXcQ --lang en
```

**Response envelope**
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
      "lang": "en",
      "source": "innertube",
      "transcript": "Never gonna give you up ..."
    }
  }
}
```

---

## Embed rule

Every response that includes a video always provides `embedUrl` in the form:

```
https://www.youtube.com/embed/<id>
```

Use this URL to render the video in an iframe or pass it to any tool that accepts an embed URL.

## Error envelope

On failure the envelope has `ok: false`:

```json
{
  "ok": false,
  "command": "transcript",
  "error": {
    "code": "NO_CAPTIONS",
    "message": "No caption tracks found for this video.",
    "hint": "Try a different language with --lang, or use the info command to confirm the video exists."
  }
}
```

## Failure modes

- **Captionless video** — if the video has no caption tracks, `transcript` will be `null` and `reason` will explain why.
- **Cloud/sandbox IP block** — YouTube may rate-limit or block requests from data-centre IPs. Set the `YTRELAY_PROXY` environment variable to an HTTP/SOCKS proxy URL to route requests through a residential IP.
- **Private or age-gated video** — `info` and `context` will return an error with code `UNAVAILABLE`.
- **Invalid ID or URL** — any command will return an error with code `INVALID_ID` before making a network request.
