# youtube-relay-mcp

A code-execution-based YouTube tool — a TypeScript CLI (`ytrelay`) + a thin MCP
shim (`youtube-relay-mcp`) + a Claude Code skill. An agent shells out to search
YouTube, fetch a transcript + title + description, and get an embeddable video
ID/URL. One engine: `youtubei.js` (InnerTube). No long-running server for the CLI
path. Published to npm.

## Dev Commands

- `bun run check` — full CI: typecheck + lint + test
- `bun test` — run tests
- `bun test --watch` — TDD watch mode
- `bun run typecheck` — TypeScript strict check
- `bun run lint` — Biome lint
- `bun run lint:fix` — auto-fix lint
- `bun run build` — generate skill + build to dist/ via tsup
- `bun run dev` — generate skill + run the CLI from source

## Architecture

- `src/cli.ts` — CLI entry (`ytrelay`); parses args, dispatches a command, prints
  a JSON envelope to stdout. Errors go to stderr with a non-zero exit.
- `src/mcp-shim.ts` — MCP server entry (`youtube-relay-mcp`); exposes the same
  commands as MCP tools. Thin wrapper, no business logic of its own.
- `src/index.ts` — library exports (the command functions + types).
- `src/youtube.ts` — the only place that talks to `youtubei.js`. Wraps
  search / getInfo / getTranscript and normalizes their output. Network lives
  here so command logic stays testable.
- `src/ids.ts` — pure video-ID extraction from any URL form. No I/O.
- `src/output.ts` — pure JSON success/error envelope formatting. No I/O.
- `src/commands/registry.ts` — single source of truth for command definitions
  (name, args, description). Drives both CLI dispatch and SKILL.md generation.
- `src/commands/{search,info,transcript,context}.ts` — one file per command.
- `scripts/generate-skill.ts` — reads `.claude/skills/youtube-relay/SKILL.md` and
  the registry, emits `src/generated/*.ts`. Runs before build/test/typecheck.

## Testing Rules

Only write tests that verify **behavior** — logic, edge cases, transformations,
error paths. Do NOT write tests that just confirm types or presence of fields
that TypeScript and Biome already enforce. If `tsc --noEmit` or `biome check`
would catch it, don't test it.

Good tests: ID extraction across URL forms, transcript normalization, the
captionless/blocked → clean-envelope mapping, embed-URL construction, arg
parsing, output envelope shape on success vs error.

Bad tests: "function returns an object with an `id` field", "property is a
string", "exported function exists".

Network calls to InnerTube are wrapped in `src/youtube.ts`; test the pure
transforms, not the network. Keep any real-call smoke test separate and do not
run it in unit CI.

## Engineering Workflow

- **TDD is mandatory** for all production code (see `test-driven-development`
  skill): write the failing test, watch it fail, then minimal code to pass.
- **Conventional Commits** — required, because `semantic-release` derives the
  version and CHANGELOG from commit messages. `feat:` → minor, `fix:` → patch,
  `feat!:`/`BREAKING CHANGE:` → major; `docs:`/`chore:`/`ci:`/`test:`/`refactor:`
  do not release.
- **Small commits** — one logical unit per commit; commit promptly so any change
  is cleanly revertible.
- Releases run from `main` (and prereleases from `beta`) via GitHub Actions.
  Never bump the version or edit CHANGELOG.md by hand — semantic-release owns
  them.

## Key Reference Documentation

- youtubei.js (InnerTube) — https://github.com/LuanRT/YouTube.js
- MCP Protocol docs — https://modelcontextprotocol.io/llms.txt
- Code execution with MCP (Anthropic) — https://www.anthropic.com/engineering/code-execution-with-mcp
- YouTube embed (iframe) — https://developers.google.com/youtube/iframe_api_reference
- semantic-release — https://semantic-release.gitbook.io/semantic-release/

## Constraints

- Scope is search + transcript + metadata + embeddable ID. No media download, no
  summarization (the agent reasons over what this returns).
- The CLI requires no API keys or secrets. Publishing uses the `NPM_TOKEN` GitHub
  Actions secret only.
- Requests assume a residential IP (local Claude Code); datacenter/cloud IPs may
  be blocked. A `YTRELAY_PROXY` env var is PLANNED but not yet wired into
  `createEngine` — do not document it as functional until it is implemented.
- Transcript text is a known limitation in v1 (YouTube PO-token wall); `search`,
  `info`, and `context` metadata work. A pure-TS transcript backend is the
  immediate fast-follow.
