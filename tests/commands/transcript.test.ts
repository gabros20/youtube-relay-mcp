import { describe, expect, test } from 'bun:test';
import { runTranscript } from '../../src/commands/transcript.ts';
import type { TranscriptResult } from '../../src/types.ts';
import { makeFakeEngine } from './fake-engine.ts';

const FULL_TRANSCRIPT: TranscriptResult = {
  id: 'dQw4w9WgXcQ',
  lang: 'en',
  source: 'innertube',
  transcript: 'Hello world',
  segments: [{ text: 'Hello world', startMs: 0, durationMs: 1000 }],
};

const CAPTIONLESS: TranscriptResult = {
  id: 'dQw4w9WgXcQ',
  lang: null,
  source: null,
  transcript: null,
  reason: 'no captions',
};

describe('runTranscript', () => {
  test('returns ok with full TranscriptResult including segments', async () => {
    const { engine } = makeFakeEngine({ transcriptResult: FULL_TRANSCRIPT });
    const result = await runTranscript(engine, { target: 'dQw4w9WgXcQ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command).toBe('transcript');
      expect(result.data.segments).toBeDefined();
      expect(result.data.transcript).toBe('Hello world');
    }
  });

  test('format:text strips segments but keeps transcript text', async () => {
    const { engine } = makeFakeEngine({ transcriptResult: FULL_TRANSCRIPT });
    const result = await runTranscript(engine, { target: 'dQw4w9WgXcQ', format: 'text' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('segments' in result.data).toBe(false);
      expect(result.data.transcript).toBe('Hello world');
      expect(result.data.lang).toBe('en');
      expect(result.data.source).toBe('innertube');
    }
  });

  test('captionless result (transcript:null + reason) returns ok — not error', async () => {
    const { engine } = makeFakeEngine({ transcriptResult: CAPTIONLESS });
    const result = await runTranscript(engine, { target: 'dQw4w9WgXcQ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.transcript).toBeNull();
      expect(result.data.reason).toBe('no captions');
    }
  });

  test('invalid target returns INVALID_INPUT without calling engine', async () => {
    const { engine, calls } = makeFakeEngine();
    const result = await runTranscript(engine, { target: 'not-valid' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
    expect(calls.getTranscript).toHaveLength(0);
  });

  test('engine throws -> FETCH_FAILED with network hint', async () => {
    const { engine } = makeFakeEngine({ transcriptThrows: new Error('status code 400') });
    const result = await runTranscript(engine, { target: 'dQw4w9WgXcQ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FETCH_FAILED');
      expect(result.error.hint).toContain('residential');
    }
  });
});
