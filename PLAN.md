# YouTube Context CLI — Implementation Plan

A small local CLI that an AI coding agent (Claude Code) calls via the shell to
**search YouTube → pull a video's transcript + title + description → return an
embeddable video ID/URL**, taught to the agent through a Skill.

No MCP server to register, no API keys for the default path, runs on a local /
residential IP.

---

## 0. Why this design (research basis)

This plan rests on a deep-research pass. The decisive findings:

- **CLI + Skill beats an MCP server here.** The task is a stateless
  request/response pipeline (`query → results`, `videoID → transcript+metadata`).
  No server lifecycle, capability negotiation, or streaming is needed, so an MCP
  server adds hosting/registration overhead for no benefit. A CLI taught via a
  `SKILL.md` is the idiomatic Claude Code extension and keeps the contract
  inspectable and version-controlled. "MCP 2.0 but CLI-based" = a skill that
  teaches the agent the command shapes.
- **Build our own, don't piggyback Gemini/Antigravity.** The free Gemini CLI path
  is deprecated **2026-06-18**, it has no search primitive, and free-tier use
  carries a privacy cost (human review of inputs/outputs). Not needed.
- **The cloud-IP block is NOT our problem.** YouTube blocks AWS/GCP/Azure
  datacenter IPs, which breaks transcript libraries *in the cloud*. Claude Code
  runs locally on a residential IP — exactly the IP class where these tools work.
  The block only returns if the tool is ever run inside a cloud sandbox, which we
  handle with an optional, env-gated proxy escape hatch (not a day-one concern).

**Scope boundary:** search + transcript + metadata + embeddable ID. No media
download. No summarization — the agent does the reasoning; this tool only fetches
grounded context.

---

## 1. Architecture

```
┌─────────────────┐     reads      ┌──────────────────────┐
│  Claude Code    │ ─────────────▶ │  SKILL.md            │  "when & how to
│  (the agent)    │                │  (teaches the agent) │   call the CLI"
└────────┬────────┘                └──────────────────────┘
         │ shells out
         ▼
┌─────────────────┐   wraps   ┌──────────────────────────────────┐
│  yt  (the CLI)  │ ────────▶ │ yt-dlp  +  youtube-transcript-api  │
│  JSON in/out    │           │ (search, metadata, transcript)     │
└─────────────────┘           └──────────────────────────────────┘
         │ returns JSON
         ▼
   {id, title, description, url, embed_url, transcript}
```

Two artifacts only: a small **CLI binary** and a **`SKILL.md`**. The skill is the
contract; the CLI is the muscle.

---

## 2. CLI surface

Single binary `yt`. Every command emits **JSON to stdout** (agent-parseable);
human-readable errors go to stderr with a non-zero exit code.

| Command | Input | Output |
|---|---|---|
| `yt search "<query>"` | `--limit N`, `--sort` | list of `{id, title, channel, duration, url, embed_url}` |
| `yt info <id\|url>` | — | `{id, title, description, channel, duration, url, embed_url}` |
| `yt transcript <id\|url>` | `--lang`, `--format text\|json` | `{id, lang, source, transcript, segments?}` |
| **`yt context <id\|url>`** | `--lang` | **metadata + transcript in one shot** — the primary command |

`yt context` is the headline command: one call returns both the *content to
reason about* and the *embed_url to drop into a page*.

---

## 3. Tech stack

- **Python** — native home of `yt-dlp` and `youtube-transcript-api`.
- **Packaging:** `uv` / `pipx`, installed as a global `yt` command callable from
  any project.
- **Dependencies:** `yt-dlp` (search + metadata + caption fallback),
  `youtube-transcript-api` (primary transcript). **Zero API keys** for the
  default path.
- **Embed:** deterministic — `https://www.youtube.com/embed/<id>`. ID extraction
  handles `watch?v=`, `youtu.be/`, `/embed/`, and `/shorts/` URL forms.

---

## 4. Transcript strategy

A small fallback ladder behind `yt transcript` / `yt context`. The winning tier
is reported in the result's `source` field so the agent knows provenance.

1. **`youtube-transcript-api` direct** → works on a local IP. **Default.**
2. **`yt-dlp --write-auto-subs`** → second surface when a video has no
   API-exposed transcript.
3. **residential proxy** (env-gated, off by default) → only if run inside a
   cloud sandbox, where datacenter-IP blocking returns.

Locally this is almost always tier 1; the ladder just means graceful degradation
instead of a hard error.

---

## 5. The Skill (`SKILL.md`)

- **Trigger / when to use** — "search YouTube, get a transcript, get an
  embeddable video."
- **Commands** — the four above, with example invocations and JSON shapes.
- **Embedding guidance** — the `<iframe>` snippet and the ID-from-any-URL rule.
- **Failure modes** — what an empty transcript means, the `source` field, and the
  cloud-sandbox proxy env var.
- **Quota note** — the default path is keyless; relevant only if a YouTube Data
  API v3 path is added later.

---

## 6. Build phases

| Phase | Deliverable | Risk |
|---|---|---|
| **0 — Scaffold** | repo, `uv` project, `yt` entrypoint, JSON plumbing | none |
| **1 — `search` + `info`** | the two keyless, always-work commands | none |
| **2 — `transcript`** | tier 1 + tier 2 fallback | low (local IP) |
| **3 — `context`** | compose 1 + 2 into one call | none |
| **4 — `SKILL.md`** | wire into Claude Code, dogfood end-to-end | none |
| **5 — (optional) proxy escape hatch** | env-gated tier 3 | defer until needed |

Phases 1–4 are the whole usable product. Phase 5 only matters for cloud-sandbox
use.

---

## 7. Open decisions

1. **Binary name** — `yt` is concise but can collide with other tools on PATH;
   `ytx` / `yt-context` are collision-safe alternatives. (Plan currently assumes
   `yt`.)
2. **Distribution** — `uv` tool install vs `pipx`; global command vs repo-local
   venv.
3. **Data API v3** — keep the keyless scraping path only, or add an optional,
   ToS-sanctioned Data API path behind an API key for production use later.

---

## Status

This document is the agreed starting point. Implementation proceeds from Phase 0,
one phase = one commit.
