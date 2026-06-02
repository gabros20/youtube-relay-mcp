#!/usr/bin/env node
// ─── youtube-relay-mcp MCP shim ───────────────────────────────────────────
// Thin @modelcontextprotocol/sdk stdio server — delegates to command runners.
// Contains NO business logic; all decisions live in src/commands/*.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runContext, runInfo, runSearch, runTranscript } from './commands/index.ts';
import { err, toJson } from './output.ts';
import type { Engine } from './youtube.ts';
import { createEngine } from './youtube.ts';

// ── Lazy shared engine ──────────────────────────────────────────────────────

let enginePromise: Promise<Engine> | undefined;
const getEngine = (): Promise<Engine> => {
  if (enginePromise === undefined) {
    enginePromise = createEngine();
  }
  return enginePromise;
};

// ── Tool result shape ───────────────────────────────────────────────────────

export type ToolContent = { type: 'text'; text: string };
export type ToolResult = { content: ToolContent[]; isError?: boolean };

// ── Pure dispatcher (testable without SDK) ──────────────────────────────────

export async function runTool(
  engine: Engine,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const text = (v: unknown): ToolResult => ({
    content: [{ type: 'text', text: toJson(v) }],
  });
  const errResult = (v: unknown): ToolResult => ({
    content: [{ type: 'text', text: toJson(v) }],
    isError: true,
  });

  if (name === 'search') {
    const query = String(args.query ?? '');
    const limitRaw = args.limit;
    const limit = limitRaw !== undefined ? Number(limitRaw) : undefined;
    const envelope = await runSearch(engine, { query, limit });
    return envelope.ok ? text(envelope) : errResult(envelope);
  }

  if (name === 'info') {
    const target = String(args.target ?? '');
    const envelope = await runInfo(engine, { target });
    return envelope.ok ? text(envelope) : errResult(envelope);
  }

  if (name === 'transcript') {
    const target = String(args.target ?? '');
    const lang = args.lang !== undefined ? String(args.lang) : undefined;
    const formatRaw = args.format;
    const format =
      formatRaw === 'text' || formatRaw === 'json' ? (formatRaw as 'text' | 'json') : undefined;
    const envelope = await runTranscript(engine, { target, lang, format });
    return envelope.ok ? text(envelope) : errResult(envelope);
  }

  if (name === 'context') {
    const target = String(args.target ?? '');
    const lang = args.lang !== undefined ? String(args.lang) : undefined;
    const envelope = await runContext(engine, { target, lang });
    return envelope.ok ? text(envelope) : errResult(envelope);
  }

  // Unknown tool name — return error envelope, never throw.
  return errResult(err('mcp', 'UNKNOWN_TOOL', `unknown tool: ${name}`));
}

// ── MCP server construction ─────────────────────────────────────────────────

function buildServer(): McpServer {
  const require = createRequire(import.meta.url);
  // biome-ignore lint/suspicious/noExplicitAny: dynamic require of package.json
  const pkg = require('../package.json') as any;
  const version = String(pkg.version);

  const server = new McpServer({ name: 'youtube-relay-mcp', version });

  server.registerTool(
    'search',
    {
      description: 'Search YouTube and return a list of video summaries.',
      inputSchema: {
        query: z.string().describe('search query'),
        limit: z.number().int().positive().optional(),
      },
    },
    async (args: unknown) => runTool(await getEngine(), 'search', args as Record<string, unknown>),
  );

  server.registerTool(
    'info',
    {
      description: 'Fetch title, description, channel, and duration for a single video.',
      inputSchema: {
        target: z.string().describe('YouTube video id or URL'),
      },
    },
    async (args: unknown) => runTool(await getEngine(), 'info', args as Record<string, unknown>),
  );

  server.registerTool(
    'transcript',
    {
      description:
        'Fetch the transcript for a video, optionally in a specific language and format.',
      inputSchema: {
        target: z.string().describe('YouTube video id or URL'),
        lang: z.string().optional(),
        format: z.enum(['text', 'json']).optional(),
      },
    },
    async (args: unknown) =>
      runTool(await getEngine(), 'transcript', args as Record<string, unknown>),
  );

  server.registerTool(
    'context',
    {
      description: 'Fetch video info and transcript together in a single call.',
      inputSchema: {
        target: z.string().describe('YouTube video id or URL'),
        lang: z.string().optional(),
      },
    },
    async (args: unknown) => runTool(await getEngine(), 'context', args as Record<string, unknown>),
  );

  return server;
}

// ── main ────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Guard: only run main when this file is the direct entry point.
const isEntry =
  import.meta.main === true ||
  (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]);

if (isEntry) {
  void main();
}
