import { describe, expect, test } from 'bun:test';
import { parseArgs, run } from '../src/cli.ts';
import { makeFakeEngine, stubInfo } from './commands/fake-engine.ts';

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  test('no args → help', () => {
    expect(parseArgs([])).toEqual({ kind: 'help' });
  });

  test('-h → help', () => {
    expect(parseArgs(['-h'])).toEqual({ kind: 'help' });
  });

  test('--help → help', () => {
    expect(parseArgs(['--help'])).toEqual({ kind: 'help' });
  });

  test('-v → version', () => {
    expect(parseArgs(['-v'])).toEqual({ kind: 'version' });
  });

  test('--version → version', () => {
    expect(parseArgs(['--version'])).toEqual({ kind: 'version' });
  });

  test('unknown command', () => {
    expect(parseArgs(['bogus'])).toEqual({ kind: 'unknown', command: 'bogus' });
  });

  test('search with multi-word query and --limit', () => {
    const result = parseArgs(['search', 'agentic eng', '--limit', '5']);
    expect(result).toEqual({
      kind: 'command',
      command: 'search',
      opts: { query: 'agentic eng', limit: 5 },
    });
  });

  test('search: multiple positionals are joined', () => {
    const result = parseArgs(['search', 'agentic', 'engineering']);
    expect(result).toEqual({
      kind: 'command',
      command: 'search',
      opts: { query: 'agentic engineering', limit: undefined },
    });
  });

  test('info with URL target', () => {
    const result = parseArgs(['info', 'https://youtu.be/abc']);
    expect(result).toEqual({
      kind: 'command',
      command: 'info',
      opts: { targets: ['https://youtu.be/abc'] },
    });
  });

  test('info with multiple targets (batch)', () => {
    const result = parseArgs(['info', 'a', 'b', 'c']);
    expect(result).toEqual({
      kind: 'command',
      command: 'info',
      opts: { targets: ['a', 'b', 'c'] },
    });
  });

  test('transcript with --lang, --format, --head, --max-chars', () => {
    const result = parseArgs([
      'transcript',
      'ID',
      '--lang',
      'en',
      '--format',
      'text',
      '--head',
      '120',
      '--max-chars',
      '1500',
    ]);
    expect(result).toEqual({
      kind: 'command',
      command: 'transcript',
      opts: { targets: ['ID'], lang: 'en', format: 'text', head: 120, maxChars: 1500 },
    });
  });

  test('search with filters', () => {
    const result = parseArgs([
      'search',
      'ai',
      '--sort',
      'views',
      '--features',
      'all',
      '--upload-date',
      'year',
      '--duration',
      'long',
    ]);
    expect(result).toEqual({
      kind: 'command',
      command: 'search',
      opts: { query: 'ai', sort: 'views', features: 'all', uploadDate: 'year', duration: 'long' },
    });
  });

  test('context with --lang', () => {
    const result = parseArgs(['context', 'dQw4w9WgXcQ', '--lang', 'en']);
    expect(result).toEqual({
      kind: 'command',
      command: 'context',
      opts: { targets: ['dQw4w9WgXcQ'], lang: 'en' },
    });
  });

  test('search without --limit has undefined limit', () => {
    const result = parseArgs(['search', 'lofi']);
    expect(result).toEqual({
      kind: 'command',
      command: 'search',
      opts: { query: 'lofi', limit: undefined },
    });
  });

  test('transcript without options', () => {
    const result = parseArgs(['transcript', 'abc123']);
    expect(result).toEqual({
      kind: 'command',
      command: 'transcript',
      opts: {
        targets: ['abc123'],
        lang: undefined,
        format: undefined,
        head: undefined,
        maxChars: undefined,
      },
    });
  });

  test('transcript --lang with no value → lang undefined, not empty string', () => {
    const result = parseArgs(['transcript', 'ID', '--lang']);
    expect(result.kind === 'command' && result.command === 'transcript' && result.opts.lang).toBe(
      undefined,
    );
  });

  test('context --lang with no value → lang undefined, not empty string', () => {
    const result = parseArgs(['context', 'ID', '--lang']);
    expect(result.kind === 'command' && result.command === 'context' && result.opts.lang).toBe(
      undefined,
    );
  });
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

describe('run', () => {
  test('help → exitCode 0 and stdout contains all four command names', async () => {
    const { engine } = makeFakeEngine();
    const { stdout, exitCode } = await run(['--help'], engine);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('search');
    expect(stdout).toContain('info');
    expect(stdout).toContain('transcript');
    expect(stdout).toContain('context');
  });

  test('help via no args → exitCode 0', async () => {
    const { engine } = makeFakeEngine();
    const { exitCode } = await run([], engine);
    expect(exitCode).toBe(0);
  });

  test('version → exitCode 0 and stdout is a semver string', async () => {
    const { engine } = makeFakeEngine();
    const { stdout, exitCode } = await run(['--version'], engine);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  test('unknown command → exitCode 2 and UNKNOWN_COMMAND envelope on stdout', async () => {
    const { engine } = makeFakeEngine();
    const { stdout, exitCode } = await run(['bogus'], engine);
    expect(exitCode).toBe(2);
    const envelope = JSON.parse(stdout);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('UNKNOWN_COMMAND');
  });

  test('search command → exitCode 0 and ok envelope with fake results', async () => {
    const fakeResults = [
      {
        id: 'abc',
        title: 'Test Video',
        channel: 'Test Channel',
        duration: '1:00',
        url: 'https://www.youtube.com/watch?v=abc',
        embedUrl: 'https://www.youtube.com/embed/abc',
      },
    ];
    const { engine } = makeFakeEngine({ searchResult: fakeResults });
    const { stdout, exitCode } = await run(['search', 'lofi'], engine);
    expect(exitCode).toBe(0);
    const envelope = JSON.parse(stdout);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toEqual(fakeResults);
  });

  test('engine throws → exitCode 1 and FETCH_FAILED envelope', async () => {
    const { engine } = makeFakeEngine({ searchThrows: new Error('network boom') });
    const { stdout, exitCode } = await run(['search', 'test'], engine);
    expect(exitCode).toBe(1);
    const envelope = JSON.parse(stdout);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('FETCH_FAILED');
  });

  test('--limit abc → exitCode 1, INVALID_INPUT, engine not called', async () => {
    const { engine, calls } = makeFakeEngine();
    const { stdout, exitCode } = await run(['search', 'test', '--limit', 'abc'], engine);
    expect(exitCode).toBe(1);
    const envelope = JSON.parse(stdout);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('INVALID_INPUT');
    expect(calls.search).toHaveLength(0);
  });

  test('--format xml → exitCode 1, INVALID_INPUT, engine not called', async () => {
    const { engine, calls } = makeFakeEngine();
    const { stdout, exitCode } = await run(['transcript', 'abc', '--format', 'xml'], engine);
    expect(exitCode).toBe(1);
    const envelope = JSON.parse(stdout);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('INVALID_INPUT');
    expect(calls.getTranscript).toHaveLength(0);
  });

  test('info command → exitCode 0 and ok envelope', async () => {
    const { engine } = makeFakeEngine({ infoResult: stubInfo('dQw4w9WgXcQ') });
    const { stdout, exitCode } = await run(['info', 'dQw4w9WgXcQ'], engine);
    expect(exitCode).toBe(0);
    const envelope = JSON.parse(stdout);
    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe('info');
  });

  test('transcript command → exitCode 0 and ok envelope', async () => {
    const { engine } = makeFakeEngine();
    const { stdout, exitCode } = await run(['transcript', 'dQw4w9WgXcQ', '--lang', 'en'], engine);
    expect(exitCode).toBe(0);
    const envelope = JSON.parse(stdout);
    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe('transcript');
  });

  test('context command → exitCode 0 and ok envelope', async () => {
    const { engine } = makeFakeEngine();
    const { stdout, exitCode } = await run(['context', 'dQw4w9WgXcQ'], engine);
    expect(exitCode).toBe(0);
    const envelope = JSON.parse(stdout);
    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe('context');
  });

  test('transcript --lang with no value does not forward an empty language code', async () => {
    const { engine, calls } = makeFakeEngine();
    await run(['transcript', 'dQw4w9WgXcQ', '--lang'], engine);
    expect(calls.getTranscript[0]?.lang).toBeUndefined();
  });

  test('search forwards filters to the engine', async () => {
    const { engine, calls } = makeFakeEngine({ searchResult: [] });
    await run(['search', 'ai', '--sort', 'views', '--features', 'all'], engine);
    expect(calls.search[0]?.opts?.sort).toBe('views');
    expect(calls.search[0]?.opts?.features).toBe('all');
  });

  test('batch info (multiple ids) → JSON array of envelopes, all called', async () => {
    const { engine, calls } = makeFakeEngine();
    const { stdout, exitCode } = await run(['info', 'dQw4w9WgXcQ', 'jNQXAC9IVRw'], engine);
    expect(exitCode).toBe(0);
    const arr = JSON.parse(stdout);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toHaveLength(2);
    expect(calls.getInfo).toEqual(['dQw4w9WgXcQ', 'jNQXAC9IVRw']);
  });

  test('batch exit code is 1 when any item fails', async () => {
    // First id valid, second invalid → runInfo returns INVALID_INPUT for it.
    const { engine } = makeFakeEngine();
    const { exitCode } = await run(['info', 'dQw4w9WgXcQ', 'not-a-valid-id'], engine);
    expect(exitCode).toBe(1);
  });

  test('single id still returns a single envelope (not an array)', async () => {
    const { engine } = makeFakeEngine();
    const { stdout } = await run(['info', 'dQw4w9WgXcQ'], engine);
    expect(Array.isArray(JSON.parse(stdout))).toBe(false);
  });

  test('`-` target reads whitespace-separated ids from stdin', async () => {
    const { engine, calls } = makeFakeEngine();
    const { exitCode } = await run(['info', '-'], engine, 'dQw4w9WgXcQ jNQXAC9IVRw\n');
    expect(exitCode).toBe(0);
    expect(calls.getInfo).toEqual(['dQw4w9WgXcQ', 'jNQXAC9IVRw']);
  });

  test('--head 0 → INVALID_INPUT, engine not called', async () => {
    const { engine, calls } = makeFakeEngine();
    const { exitCode, stdout } = await run(['transcript', 'dQw4w9WgXcQ', '--head', '0'], engine);
    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout).error.code).toBe('INVALID_INPUT');
    expect(calls.getTranscript).toHaveLength(0);
  });

  test('--max-chars caps the transcript text', async () => {
    const { engine } = makeFakeEngine({
      transcriptResult: {
        id: 'dQw4w9WgXcQ',
        lang: 'en',
        source: 'innertube',
        transcript: 'aaaa\nbbbb\ncccc',
        segments: [
          { text: 'aaaa', startMs: 0, durationMs: 1 },
          { text: 'bbbb', startMs: 10, durationMs: 1 },
          { text: 'cccc', startMs: 20, durationMs: 1 },
        ],
      },
    });
    const { stdout } = await run(['transcript', 'dQw4w9WgXcQ', '--max-chars', '9'], engine);
    expect(JSON.parse(stdout).data.transcript).toBe('aaaa\nbbbb');
  });
});

// ---------------------------------------------------------------------------
// frame (parse + dispatch with a fake extractor)
// ---------------------------------------------------------------------------

import type { FrameExtractor } from '../src/frame.ts';

function fakeFrameExtractor() {
  const calls = { grab: [] as number[] };
  const extractor: FrameExtractor = {
    async depsAvailable() {
      return { ffmpeg: true, ytdlp: true };
    },
    async resolveStreamUrl(id) {
      return `http://stream/${id}`;
    },
    async grabFrame(_url, seconds) {
      calls.grab.push(seconds);
      return { width: 1920, height: 1080 };
    },
  };
  return { extractor, calls };
}

describe('parseArgs frame', () => {
  test('repeatable --at, plus --res/--format/--out', () => {
    const r = parseArgs([
      'frame',
      'dQw4w9WgXcQ',
      '--at',
      '1:30',
      '--at',
      '2:05',
      '--res',
      '1080',
      '--format',
      'png',
      '--out',
      '/tmp/f',
    ]);
    expect(r).toEqual({
      kind: 'command',
      command: 'frame',
      opts: {
        target: 'dQw4w9WgXcQ',
        ats: ['1:30', '2:05'],
        res: 1080,
        format: 'png',
        outDir: '/tmp/f',
      },
    });
  });
});

describe('run frame', () => {
  test('parses timestamps and extracts frames (ok, exit 0)', async () => {
    const { engine } = makeFakeEngine();
    const { extractor, calls } = fakeFrameExtractor();
    const { stdout, exitCode } = await run(
      ['frame', 'dQw4w9WgXcQ', '--at', '1:30', '--at', '2:05'],
      engine,
      '',
      extractor,
    );
    expect(exitCode).toBe(0);
    const env = JSON.parse(stdout);
    expect(env.ok).toBe(true);
    expect(env.data.frames).toHaveLength(2);
    expect(calls.grab).toEqual([90, 125]); // 1:30 and 2:05 in seconds
  });

  test('invalid --at → INVALID_INPUT', async () => {
    const { engine } = makeFakeEngine();
    const { extractor } = fakeFrameExtractor();
    const { exitCode, stdout } = await run(
      ['frame', 'dQw4w9WgXcQ', '--at', 'soon'],
      engine,
      '',
      extractor,
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout).error.code).toBe('INVALID_INPUT');
  });

  test('no --at → INVALID_INPUT', async () => {
    const { engine } = makeFakeEngine();
    const { extractor } = fakeFrameExtractor();
    const { exitCode } = await run(['frame', 'dQw4w9WgXcQ'], engine, '', extractor);
    expect(exitCode).toBe(1);
  });
});
