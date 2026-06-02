# youtube-relay-mcp — Implementation Plan

A code-execution-based YouTube tool — a TypeScript CLI (`ytrelay`) + a thin MCP
shim + a Claude Code skill. An AI agent calls it via the shell to **search
YouTube → pull a video's transcript + title + description → return an embeddable
video ID/URL**. Published to npm, modeled on `slack-relay-mcp`.

---

## 0. Why this design (research + grill outcome)

A deep-research pass and a design grill settled the approach:

- **CLI + skill (+ thin MCP shim) beats a standalone MCP server.** The task is a
  stateless request/response pipeline (`query → results`, `videoID →
  transcript+metadata`). The agent shells out to a CLI taught by a `SKILL.md`;
  the MCP shim is a cheap wrapper kept for parity with `slack-relay-mcp` and for
  non-CLI hosts.
- **Build our own in Node, don't piggyback Gemini/Antigravity.** Free Gemini CLI
  is deprecated 2026-06-18, has no search primitive, and free-tier use carries a
  privacy cost. Not needed.
- **`youtubei.js` (InnerTube) is the single engine.** One pure-Node dependency
  does search, video info (title/description/id), and transcripts — no Python, no
  external binary, clean `npm i -g`.
- **Cloud-IP blocking is not our problem by default.** Claude Code runs locally
  on a residential IP, where InnerTube works. The block only returns inside a
  cloud sandbox; we document an optional proxy env var for that case rather than
  building for it day one.

**Scope boundary:** search + transcript + metadata + embeddable ID. No media
download. No summarization — the agent reasons; this tool only fetches grounded
context.

---

## 1. Locked decisions (grill)

| Decision | Choice |
|---|---|
| npm package | `youtube-relay-mcp` (public, unscoped, owner `gabros20`) |
| Bins | `ytrelay` (CLI), `youtube-relay-mcp` (MCP shim) |
| Engine | `youtubei.js` |
| Language/build | TypeScript + ESM, `tsup` |
| Package manager / test | Bun + `bun test` |
| Lint/format | Biome |
| Release | `semantic-release` (config in `package.json`), Conventional Commits |
| CI/CD | GitHub Actions: `ci.yml` (typecheck→lint→test→build→pack) + `release.yml` |
| SKILL.md | generated from a command registry via `scripts/generate-skill.ts`, shipped in `files[]` |
| Transcript v1 | youtubei.js only; graceful `null`/error JSON; proxy caveat in skill |

---

## 2. Architecture

```
┌─────────────────┐     reads      ┌────────────────────────────┐
│  Claude Code    │ ─────────────▶ │ .claude/skills/youtube-relay │
│  (the agent)    │                │ /SKILL.md (teaches the CLI)  │
└────────┬────────┘                └────────────────────────────┘
         │ shells out: `ytrelay <cmd> ...`
         ▼
┌─────────────────┐   wraps   ┌──────────────────────────────┐
│  ytrelay (CLI)  │ ────────▶ │ src/youtube.ts (engine)       │
│  JSON in/out    │           │   └─ youtubei.js (InnerTube)  │
└─────────────────┘           └──────────────────────────────┘
         ▲
         │ same commands exposed as MCP tools
┌─────────────────────┐
│ youtube-relay-mcp   │  (thin @modelcontextprotocol/sdk shim)
└─────────────────────┘
```

Entry points (mirrors slack-relay-mcp): `src/index.ts` (library),
`src/cli.ts` (CLI), `src/mcp-shim.ts` (MCP server).

---

## 3. Module layout

```
src/
  index.ts            library exports
  cli.ts              arg parse → dispatch → JSON to stdout (shebang)
  mcp-shim.ts         MCP server exposing the 4 commands as tools (shebang)
  youtube.ts          InnerTube engine wrapper (search / getInfo / getTranscript)
  ids.ts              video-ID extraction from any URL form (PURE, TDD core)
  commands/
    registry.ts       single source of truth: command defs (name, args, desc)
    search.ts  info.ts  transcript.ts  context.ts
  output.ts           JSON success/error envelope formatting (PURE, TDD core)
  types.ts
  generated/          generated skill string (gitignored, built)
scripts/
  generate-skill.ts   registry + SKILL.md → src/generated/*.ts
.claude/skills/youtube-relay/SKILL.md
tests/                bun tests (behavior only)
```

---

## 4. CLI surface (and MCP tools)

Every command emits **JSON to stdout**; human errors to stderr, non-zero exit.

| Command | Input | Output |
|---|---|---|
| `ytrelay search "<query>"` | `--limit N` | `[{id, title, channel, duration, url, embed_url}]` |
| `ytrelay info <id\|url>` | — | `{id, title, description, channel, duration, url, embed_url}` |
| `ytrelay transcript <id\|url>` | `--lang`, `--format text\|json` | `{id, lang, source, transcript|null, reason?}` |
| **`ytrelay context <id\|url>`** | `--lang` | metadata + transcript in one shot — the primary command |

Embed is deterministic: `https://www.youtube.com/embed/<id>`. ID extraction
handles `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, and bare IDs.

---

## 5. Transcript behavior (v1)

```
youtubei.js getTranscript
  ok       → { transcript, lang, source: "innertube" }
  none     → { transcript: null, reason: "no captions" }
  blocked  → { error, hint: "set YTRELAY_PROXY if running in a cloud sandbox" }
```

Never crash on a captionless/blocked video — always return a clean envelope.

---

## 6. TDD focus

Pure, behavior-rich units get tests first (Iron Law): **ID extraction**,
**output envelope formatting**, **transcript normalization + empty/error
mapping**, **arg parsing**. Network calls to InnerTube are wrapped behind
`youtube.ts` so command logic is testable without hitting the network; a thin
real-call smoke test is kept separate.

---

## 7. Build phases (one Conventional commit each)

| Phase | Deliverable |
|---|---|
| **0 — Scaffold** | package.json, tsconfig, biome, tsup, .gitignore, CI/release workflows, LICENSE, CLAUDE.md |
| **1 — Core** | `ids.ts`, `output.ts`, `types.ts` (TDD) |
| **2 — Engine** | `youtube.ts` InnerTube wrapper + normalization (TDD on transforms) |
| **3 — Commands** | `registry.ts` + `search/info/transcript/context` (TDD) |
| **4 — CLI** | `cli.ts` arg parsing + dispatch + JSON output (TDD on parsing) |
| **5 — MCP shim** | `mcp-shim.ts` exposing the 4 commands as MCP tools |
| **6 — Skill gen** | `scripts/generate-skill.ts` + hand-authored `SKILL.md` body |
| **7 — Publish** | GitHub repo, push, NPM_TOKEN secret, first semantic-release |

---

## 8. Manual steps the user must do

- Provide an **npm automation token** → stored as the `NPM_TOKEN` GitHub Actions
  secret (publish auth). The CLI itself needs no secrets.

---

## Status

v1 built via subagent-driven-development + TDD (110 tests). `search`, `info`, and
`context` metadata work live; CLI + MCP shim verified end-to-end (real video
fetch + MCP `initialize` handshake).

**Transcript deferred (known limitation).** YouTube now requires a PO token on
its `get_transcript` endpoint and on timedtext caption URLs, so the bundled
`youtubei.js` engine returns HTTP 400 / empty even from a residential IP
(confirmed concretely; `yt-dlp` still works locally, proving it's a PO-token
issue, not an outage). The `transcript` command and `context`'s transcript field
are wired and degrade gracefully (clean `FETCH_FAILED` + honest hint). v1 ships
without working transcript text. **Next:** research a pure-TS transcript backend
(PO-token generation via botguard, or a caption-URL path with the required
`pot` param) — tracked as the immediate fast-follow.
