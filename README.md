# youtube-relay-mcp

A code-execution-based YouTube tool for AI agents — a TypeScript **CLI**
(`ytrelay`), a thin **MCP shim** (`youtube-relay-mcp`), and a **Claude Code
skill**. Search YouTube, fetch a video's transcript + title + description, and
get a clean, embeddable video ID/URL. One engine: [`youtubei.js`](https://github.com/LuanRT/YouTube.js).

> Status: under active initial development. Not yet published.

## Install

```bash
npm i -g youtube-relay-mcp
```

## CLI

Every command prints a JSON envelope to stdout.

```bash
ytrelay search "agentic engineering" --limit 10
ytrelay info <id|url>
ytrelay transcript <id|url> --lang en
ytrelay context <id|url>     # metadata + transcript in one shot
```

`context` is the primary command: one call returns everything an agent needs to
both reason about a video and embed it (`https://www.youtube.com/embed/<id>`).

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
