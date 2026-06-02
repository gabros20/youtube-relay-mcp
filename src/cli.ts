import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runContext, runInfo, runSearch, runTranscript } from './commands/index.ts';
import { COMMANDS, commandNames } from './commands/registry.ts';
import { err, toJson } from './output.ts';
import type {
  ContextResult,
  Envelope,
  TranscriptResult,
  VideoInfo,
  VideoSummary,
} from './types.ts';
import type { Engine } from './youtube.ts';
import { createEngine } from './youtube.ts';

// ---------------------------------------------------------------------------
// ParsedCommand discriminated union
// ---------------------------------------------------------------------------

type SearchOpts = { query: string; limit?: number };
type InfoOpts = { target: string };
type TranscriptOpts = { target: string; lang?: string; format?: string };
type ContextOpts = { target: string; lang?: string };

export type ParsedCommand =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'command'; command: 'search'; opts: SearchOpts }
  | { kind: 'command'; command: 'info'; opts: InfoOpts }
  | { kind: 'command'; command: 'transcript'; opts: TranscriptOpts }
  | { kind: 'command'; command: 'context'; opts: ContextOpts }
  | { kind: 'unknown'; command: string };

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

export function parseArgs(argv: string[]): ParsedCommand {
  if (argv.length === 0) return { kind: 'help' };

  const first = argv[0] ?? '';

  if (first === '-h' || first === '--help') return { kind: 'help' };
  if (first === '-v' || first === '--version') return { kind: 'version' };

  if (!commandNames.includes(first)) {
    return { kind: 'unknown', command: first };
  }

  const rest = argv.slice(1);

  if (first === 'search') {
    const { positionals, flags } = tokenize(rest);
    const query = positionals.join(' ');
    const limitRaw = flags['--limit'];
    const limit = limitRaw !== undefined ? Number(limitRaw) : undefined;
    return { kind: 'command', command: 'search', opts: { query, limit } };
  }

  if (first === 'info') {
    const { positionals } = tokenize(rest);
    const target = positionals[0] ?? '';
    return { kind: 'command', command: 'info', opts: { target } };
  }

  if (first === 'transcript') {
    const { positionals, flags } = tokenize(rest);
    const target = positionals[0] ?? '';
    const lang = flags['--lang'] || undefined;
    const format = flags['--format'];
    return { kind: 'command', command: 'transcript', opts: { target, lang, format } };
  }

  // context
  const { positionals, flags } = tokenize(rest);
  const target = positionals[0] ?? '';
  const lang = flags['--lang'] || undefined;
  return { kind: 'command', command: 'context', opts: { target, lang } };
}

// ---------------------------------------------------------------------------
// Minimal flag/positional tokeniser
// ---------------------------------------------------------------------------

function tokenize(argv: string[]): { positionals: string[]; flags: Record<string, string> } {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  let i = 0;
  while (i < argv.length) {
    const tok = argv[i];
    if (tok?.startsWith('--')) {
      const val = argv[i + 1];
      if (val !== undefined && !val.startsWith('--')) {
        flags[tok] = val;
        i += 2;
      } else {
        flags[tok] = '';
        i += 1;
      }
    } else {
      if (tok !== undefined) positionals.push(tok);
      i += 1;
    }
  }
  return { positionals, flags };
}

// ---------------------------------------------------------------------------
// usage
// ---------------------------------------------------------------------------

function usage(): string {
  const lines: string[] = ['Usage: ytrelay <command> [options]', '', 'Commands:'];
  for (const cmd of COMMANDS) {
    lines.push(`  ${cmd.name.padEnd(12)} ${cmd.summary}`);
    lines.push(`    Usage:   ${cmd.usage}`);
    lines.push(`    Example: ${cmd.example}`);
    for (const arg of cmd.args) {
      lines.push(`    ${arg.flag.padEnd(20)} ${arg.description}`);
    }
    lines.push('');
  }
  lines.push('Flags:');
  lines.push('  -h, --help     Show this help message');
  lines.push('  -v, --version  Show package version');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

export async function run(
  argv: string[],
  engine: Engine,
): Promise<{ stdout: string; exitCode: number }> {
  const parsed = parseArgs(argv);

  if (parsed.kind === 'help') {
    return { stdout: usage(), exitCode: 0 };
  }

  if (parsed.kind === 'version') {
    const require = createRequire(import.meta.url);
    // biome-ignore lint/suspicious/noExplicitAny: dynamic require of package.json
    const pkg = require('../package.json') as any;
    return { stdout: String(pkg.version), exitCode: 0 };
  }

  if (parsed.kind === 'unknown') {
    const stdout = toJson(
      err('cli', 'UNKNOWN_COMMAND', `unknown command: ${parsed.command}`, 'run `ytrelay --help`'),
    );
    return { stdout, exitCode: 2 };
  }

  // Validation owned by cli, not by runners
  if (parsed.command === 'search') {
    const { limit } = parsed.opts;
    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
      return {
        stdout: toJson(err('search', 'INVALID_INPUT', '--limit must be a positive integer')),
        exitCode: 1,
      };
    }
  }

  if (parsed.command === 'transcript') {
    const { format } = parsed.opts;
    if (format !== undefined && format !== 'text' && format !== 'json') {
      return {
        stdout: toJson(err('transcript', 'INVALID_INPUT', '--format must be text or json')),
        exitCode: 1,
      };
    }
  }

  // Dispatch to runners
  let envelope: Envelope<VideoSummary[] | VideoInfo | TranscriptResult | ContextResult>;

  if (parsed.command === 'search') {
    envelope = await runSearch(engine, parsed.opts);
  } else if (parsed.command === 'info') {
    envelope = await runInfo(engine, parsed.opts);
  } else if (parsed.command === 'transcript') {
    const transcriptOpts = {
      ...parsed.opts,
      format: parsed.opts.format as 'text' | 'json' | undefined,
    };
    envelope = await runTranscript(engine, transcriptOpts);
  } else {
    envelope = await runContext(engine, parsed.opts);
  }

  return { stdout: toJson(envelope), exitCode: envelope.ok ? 0 : 1 };
}

// ---------------------------------------------------------------------------
// main — only executed when this file is the direct entry point
// ---------------------------------------------------------------------------

export async function main(): Promise<void> {
  const engine = await createEngine();
  const { stdout, exitCode } = await run(process.argv.slice(2), engine);
  process.stdout.write(`${stdout}\n`);
  process.exit(exitCode);
}

// Guard: only run main when executed as the entry point (not when imported).
// import.meta.main is true in Bun when the file is the program entry; in Node/tsup
// we fall back to an OS-native absolute-path comparison (Windows-safe — no
// hard-coded forward-slash suffix matching).
const isEntry =
  import.meta.main === true ||
  (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]);

if (isEntry) {
  void main();
}
