import { describe, expect, test } from 'bun:test';
import { runInfo } from '../../src/commands/info.ts';
import { makeFakeEngine, stubInfo } from './fake-engine.ts';

describe('runInfo', () => {
  test('valid video id returns ok envelope with VideoInfo', async () => {
    const id = 'dQw4w9WgXcQ';
    const { engine } = makeFakeEngine({ infoResult: stubInfo(id) });
    const result = await runInfo(engine, { target: id });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command).toBe('info');
      expect(result.data.id).toBe(id);
    }
  });

  test('full youtube url target works', async () => {
    const { engine, calls } = makeFakeEngine();
    const result = await runInfo(engine, { target: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    expect(result.ok).toBe(true);
    expect(calls.getInfo[0]).toBe('dQw4w9WgXcQ');
  });

  test('invalid target returns INVALID_INPUT without calling engine', async () => {
    const { engine, calls } = makeFakeEngine();
    const result = await runInfo(engine, { target: 'not-a-valid-id-or-url' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
      expect(result.error.message).toContain('not-a-valid-id-or-url');
    }
    expect(calls.getInfo).toHaveLength(0);
  });

  test('engine throws -> FETCH_FAILED with proxy hint', async () => {
    const { engine } = makeFakeEngine({ infoThrows: new Error('HTTP 429') });
    const result = await runInfo(engine, { target: 'dQw4w9WgXcQ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FETCH_FAILED');
      expect(result.error.message).toContain('HTTP 429');
      expect(result.error.hint).toContain('YTRELAY_PROXY');
    }
  });
});
