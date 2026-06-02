import { describe, expect, test } from 'bun:test';
import { runContext } from '../../src/commands/context.ts';
import { makeFakeEngine, stubInfo, stubTranscript } from './fake-engine.ts';

const ID = 'dQw4w9WgXcQ';

describe('runContext', () => {
  test('returns ok with combined VideoInfo + TranscriptResult', async () => {
    const info = stubInfo(ID);
    const transcript = stubTranscript(ID, 'en');
    const { engine } = makeFakeEngine({ infoResult: info, transcriptResult: transcript });
    const result = await runContext(engine, { target: ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command).toBe('context');
      expect(result.data.id).toBe(ID);
      expect(result.data.title).toBe(info.title);
      expect(result.data.transcript.id).toBe(ID);
      expect(result.data.transcript.transcript).toBe('Hello world');
    }
  });

  test('when getTranscript throws, context is still ok with metadata + degraded transcript', async () => {
    const info = stubInfo(ID);
    const { engine } = makeFakeEngine({
      infoResult: info,
      transcriptThrows: new Error('transcript unavailable'),
    });
    const result = await runContext(engine, { target: ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe(info.title);
      expect(result.data.url).toBe(info.url);
      expect(result.data.embedUrl).toBe(info.embedUrl);
      expect(result.data.transcript.transcript).toBeNull();
      expect(result.data.transcript.reason).toContain('transcript unavailable');
    }
  });

  test('when getInfo throws, returns FETCH_FAILED', async () => {
    const { engine } = makeFakeEngine({ infoThrows: new Error('video not found') });
    const result = await runContext(engine, { target: ID });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FETCH_FAILED');
      expect(result.error.hint).toContain('YTRELAY_PROXY');
    }
  });

  test('invalid target returns INVALID_INPUT without calling engine', async () => {
    const { engine, calls } = makeFakeEngine();
    const result = await runContext(engine, { target: 'not-valid' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
    expect(calls.getInfo).toHaveLength(0);
    expect(calls.getTranscript).toHaveLength(0);
  });

  test('lang is forwarded to getTranscript', async () => {
    const { engine, calls } = makeFakeEngine();
    await runContext(engine, { target: ID, lang: 'hu' });
    expect(calls.getTranscript[0]?.lang).toBe('hu');
  });
});
