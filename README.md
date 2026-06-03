# youtube-relay-mcp

A **deep-research tool for YouTube** for AI agents — a TypeScript **CLI**
(`ytrelay`), an **MCP server** (`youtube-relay-mcp`), and a **Claude Code skill**.
Cast a wide net, rank candidates cheaply on metadata, peek before committing, and
read full transcripts only for the finalists. One engine:
[`youtubei.js`](https://github.com/LuanRT/YouTube.js).

> **Status:** all four commands work — enriched, captioned-only-by-default search
> (views, recency, verified, snippet); rich `info` (full description, chapters,
> caption availability); transcripts via the signed `timedtext` caption URL (no
> PO token / external binary); a peek tier (`--head`/`--max-chars`); and batch +
> stdin ergonomics. The bundled `SKILL.md` teaches the recommended funnel.

## Install

```bash
npm i -g youtube-relay-mcp
```

## CLI

Every command prints a JSON envelope to stdout.

```bash
ytrelay search "agentic engineering" --limit 30 --sort views   # cheap, enriched, captioned-only
ytrelay info <id|url> [<id> ...]      # full description + chapters + caption info (batch ok)
ytrelay transcript <id|url> --head 120   # PEEK: first 2 min; or --max-chars N
ytrelay context <id|url>              # metadata + full transcript + embed in one shot
ytrelay frame <id|url> --at 1:30      # high-res still frame at a timestamp (needs ffmpeg + yt-dlp)
```

`frame` extracts full-resolution stills at exact timestamps (pairs with transcript
`startMs` to *see* a moment). It's the only command needing external binaries
(**ffmpeg + yt-dlp** on PATH); the rest are pure-Node.

**The funnel** (see [`SKILL.md`](./.claude/skills/youtube-relay/SKILL.md)): rank
on cheap search metadata → enrich the shortlist with `info` → peek finalists with
`transcript --head` → full read only the survivors. `--features all` widens search
beyond captioned videos. Every result carries `embedUrl`
(`https://www.youtube.com/embed/<id>`).

## Why a CLI + skill (not a standalone MCP server)

The task is a stateless search/fetch pipeline. An agent shells out to the CLI,
taught by the bundled `SKILL.md`. The MCP shim is provided for parity and
non-CLI hosts. See [`PLAN.md`](./PLAN.md) for the full design rationale.

## Development

```bash
bun install
bun run check     # typecheck + lint + test
bun test --watch  # TDD
bun run build     # → dist/
```

## License

MIT © Tamas Gabor
