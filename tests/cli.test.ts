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
      opts: { target: 'https://youtu.be/abc' },
    });
  });

  test('transcript with --lang and --format', () => {
    const result = parseArgs(['transcript', 'ID', '--lang', 'en', '--format', 'text']);
    expect(result).toEqual({
      kind: 'command',
      command: 'transcript',
      opts: { target: 'ID', lang: 'en', format: 'text' },
    });
  });

  test('context with --lang', () => {
    const result = parseArgs(['context', 'dQw4w9WgXcQ', '--lang', 'en']);
    expect(result).toEqual({
      kind: 'command',
      command: 'context',
      opts: { target: 'dQw4w9WgXcQ', lang: 'en' },
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
      opts: { target: 'abc123', lang: undefined, format: undefined },
    });
  });

  test('transcript --lang with no value → lang undefined, not empty string', () => {
    const result = parseArgs(['transcript', 'ID', '--lang']);
    expect(result).toEqual({
      kind: 'command',
      command: 'transcript',
      opts: { target: 'ID', lang: undefined, format: undefined },
    });
  });

  test('context --lang with no value → lang undefined, not empty string', () => {
    const result = parseArgs(['context', 'ID', '--lang']);
    expect(result).toEqual({
      kind: 'command',
      command: 'context',
      opts: { target: 'ID', lang: undefined },
    });
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
});
