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
import type { Engine, SearchOpts } from './youtube.ts';
import { createEngine } from './youtube.ts';

// ---------------------------------------------------------------------------
// ParsedCommand discriminated union
// ---------------------------------------------------------------------------

type SearchCmdOpts = {
  query: string;
  limit?: number;
  sort?: SearchOpts['sort'];
  uploadDate?: SearchOpts['uploadDate'];
  duration?: SearchOpts['duration'];
  features?: SearchOpts['features'];
};
// Batch commands take one or more targets (positional ids/URLs). A literal `-`
// target means "read whitespace-separated ids from stdin".
type InfoOpts = { targets: string[] };
type TranscriptOpts = {
  targets: string[];
  lang?: string;
  format?: string;
  head?: number;
  maxChars?: number;
};
type ContextOpts = { targets: string[]; lang?: string };

export type ParsedCommand =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'command'; command: 'search'; opts: SearchCmdOpts }
  | { kind: 'command'; command: 'info'; opts: InfoOpts }
  | { kind: 'command'; command: 'transcript'; opts: TranscriptOpts }
  | { kind: 'command'; command: 'context'; opts: ContextOpts }
  | { kind: 'unknown'; command: string };

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

const numFlag = (v: string | undefined): number | undefined =>
  v !== undefined && v !== '' ? Number(v) : undefined;

export function parseArgs(argv: string[]): ParsedCommand {
  if (argv.length === 0) return { kind: 'help' };

  const first = argv[0] ?? '';

  if (first === '-h' || first === '--help') return { kind: 'help' };
  if (first === '-v' || first === '--version') return { kind: 'version' };

  if (!commandNames.includes(first)) {
    return { kind: 'unknown', command: first };
  }

  const { positionals, flags } = tokenize(argv.slice(1));

  if (first === 'search') {
    return {
      kind: 'command',
      command: 'search',
      opts: {
        query: positionals.join(' '),
        limit: numFlag(flags['--limit']),
        sort: (flags['--sort'] as SearchOpts['sort']) || undefined,
        uploadDate: (flags['--upload-date'] as SearchOpts['uploadDate']) || undefined,
        duration: (flags['--duration'] as SearchOpts['duration']) || undefined,
        features: (flags['--features'] as SearchOpts['features']) || undefined,
      },
    };
  }

  if (first === 'info') {
    return { kind: 'command', command: 'info', opts: { targets: positionals } };
  }

  if (first === 'transcript') {
    return {
      kind: 'command',
      command: 'transcript',
      opts: {
        targets: positionals,
        lang: flags['--lang'] || undefined,
        format: flags['--format'],
        head: numFlag(flags['--head']),
        maxChars: numFlag(flags['--max-chars']),
      },
    };
  }

  // context
  return {
    kind: 'command',
    command: 'context',
    opts: { targets: positionals, lang: flags['--lang'] || undefined },
  };
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

type AnyEnvelope = Envelope<VideoSummary[] | VideoInfo | TranscriptResult | ContextResult>;

const invalid = (command: string, message: string) => ({
  stdout: toJson(err(command, 'INVALID_INPUT', message)),
  exitCode: 1,
});

/**
 * Runs the CLI. `stdin` is the raw stdin contents (default ''); a literal `-`
 * target in a batch command is expanded to whitespace-separated ids from it.
 */
export async function run(
  argv: string[],
  engine: Engine,
  stdin = '',
): Promise<{ stdout: string; exitCode: number }> {
  const parsed = parseArgs(argv);

  if (parsed.kind === 'help') return { stdout: usage(), exitCode: 0 };

  if (parsed.kind === 'version') {
    const require = createRequire(import.meta.url);
    // biome-ignore lint/suspicious/noExplicitAny: dynamic require of package.json
    const pkg = require('../package.json') as any;
    return { stdout: String(pkg.version), exitCode: 0 };
  }

  if (parsed.kind === 'unknown') {
    return {
      stdout: toJson(
        err('cli', 'UNKNOWN_COMMAND', `unknown command: ${parsed.command}`, 'run `ytrelay --help`'),
      ),
      exitCode: 2,
    };
  }

  // search — single query, no batch.
  if (parsed.command === 'search') {
    const { limit } = parsed.opts;
    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
      return invalid('search', '--limit must be a positive integer');
    }
    const envelope = await runSearch(engine, parsed.opts);
    return { stdout: toJson(envelope), exitCode: envelope.ok ? 0 : 1 };
  }

  // transcript flag validation (owned by the CLI, before any engine call).
  if (parsed.command === 'transcript') {
    const { format, head, maxChars } = parsed.opts;
    if (format !== undefined && format !== 'text' && format !== 'json') {
      return invalid('transcript', '--format must be text or json');
    }
    if (head !== undefined && !(head > 0)) return invalid('transcript', '--head must be positive');
    if (maxChars !== undefined && !(maxChars > 0)) {
      return invalid('transcript', '--max-chars must be positive');
    }
  }

  // Resolve batch targets, expanding a `-` target from stdin.
  const targets = parsed.opts.targets.flatMap((t) =>
    t === '-' ? stdin.trim().split(/\s+/).filter(Boolean) : [t],
  );

  const callOne = (target: string): Promise<AnyEnvelope> => {
    if (parsed.command === 'info') return runInfo(engine, { target });
    if (parsed.command === 'transcript') {
      return runTranscript(engine, {
        target,
        lang: parsed.opts.lang,
        format: parsed.opts.format as 'text' | 'json' | undefined,
        head: parsed.opts.head,
        maxChars: parsed.opts.maxChars,
      });
    }
    return runContext(engine, { target, lang: parsed.opts.lang });
  };

  // 0 or 1 target → single envelope (back-compatible). >1 → JSON array.
  if (targets.length <= 1) {
    const envelope = await callOne(targets[0] ?? '');
    return { stdout: toJson(envelope), exitCode: envelope.ok ? 0 : 1 };
  }
  const results = await Promise.all(targets.map(callOne));
  return { stdout: toJson(results), exitCode: results.every((e) => e.ok) ? 0 : 1 };
}

// ---------------------------------------------------------------------------
// main — only executed when this file is the direct entry point
// ---------------------------------------------------------------------------

/** Reads stdin to a string. Only called when a `-` target is present. */
async function readStdin(): Promise<string> {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

export async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  // Only touch stdin when the user explicitly asked for it (a `-` target),
  // so normal invocations never block waiting on an open pipe.
  const stdin = argv.includes('-') ? await readStdin() : '';
  const engine = await createEngine();
  const { stdout, exitCode } = await run(argv, engine, stdin);
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
