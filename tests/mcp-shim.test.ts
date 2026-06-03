import { describe, expect, test } from 'bun:test';
import { runTool } from '../src/mcp-shim.ts';
import type { VideoSummary } from '../src/types.ts';
import { makeFakeEngine, stubInfo, stubTranscript } from './commands/fake-engine.ts';

const RICK_ID = 'dQw4w9WgXcQ';
const RICK_URL = `https://youtu.be/${RICK_ID}`;

const STUB_RESULTS: VideoSummary[] = [
  {
    id: RICK_ID,
    title: 'Never Gonna Give You Up',
    channel: 'Rick Astley',
    duration: '3:33',
    url: `https://www.youtube.com/watch?v=${RICK_ID}`,
    embedUrl: `https://www.youtube.com/embed/${RICK_ID}`,
  },
];

describe('runTool', () => {
  // ── search ────────────────────────────────────────────────────────────────

  test('search: ok envelope with results', async () => {
    const { engine } = makeFakeEngine({ searchResult: STUB_RESULTS });
    const result = await runTool(engine, 'search', { query: 'x', limit: 3 });
    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    const envelope = JSON.parse(result.content[0]?.text);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toEqual(STUB_RESULTS);
  });

  test('search: forwards limit to engine', async () => {
    const { engine, calls } = makeFakeEngine({ searchResult: [] });
    await runTool(engine, 'search', { query: 'bun', limit: 7 });
    expect(calls.search[0]?.opts?.limit).toBe(7);
  });

  // ── info ──────────────────────────────────────────────────────────────────

  test('info: bad target → isError true, INVALID_INPUT envelope', async () => {
    const { engine, calls } = makeFakeEngine();
    const result = await runTool(engine, 'info', { target: 'not-a-valid-id' });
    expect(result.isError).toBe(true);
    const envelope = JSON.parse(result.content[0]?.text);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('INVALID_INPUT');
    // engine must not be called for an invalid ID
    expect(calls.getInfo).toHaveLength(0);
  });

  test('info: valid id → ok envelope with info', async () => {
    const { engine } = makeFakeEngine({ infoResult: stubInfo(RICK_ID) });
    const result = await runTool(engine, 'info', { target: RICK_ID });
    expect(result.isError).toBeFalsy();
    const envelope = JSON.parse(result.content[0]?.text);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.id).toBe(RICK_ID);
  });

  // ── transcript ────────────────────────────────────────────────────────────

  test('transcript: engine throws → isError true, FETCH_FAILED envelope', async () => {
    const { engine } = makeFakeEngine({ transcriptThrows: new Error('quota') });
    const result = await runTool(engine, 'transcript', { target: RICK_ID });
    expect(result.isError).toBe(true);
    const envelope = JSON.parse(result.content[0]?.text);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('FETCH_FAILED');
  });

  test('transcript: forwards lang and format', async () => {
    const { engine, calls } = makeFakeEngine({
      transcriptResult: stubTranscript(RICK_ID, 'en'),
    });
    const result = await runTool(engine, 'transcript', {
      target: RICK_ID,
      lang: 'en',
      format: 'text',
    });
    expect(result.isError).toBeFalsy();
    // lang was passed to engine
    expect(calls.getTranscript[0]?.lang).toBe('en');
    // format=text strips segments — no segments key
    const envelope = JSON.parse(result.content[0]?.text);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.segments).toBeUndefined();
  });

  // ── context ───────────────────────────────────────────────────────────────

  test('context: URL target → ok envelope with metadata + transcript', async () => {
    const { engine } = makeFakeEngine({
      infoResult: stubInfo(RICK_ID),
      transcriptResult: stubTranscript(RICK_ID, 'en'),
    });
    const result = await runTool(engine, 'context', { target: RICK_URL });
    expect(result.isError).toBeFalsy();
    const envelope = JSON.parse(result.content[0]?.text);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.id).toBe(RICK_ID);
    expect(envelope.data.transcript).toBeDefined();
    expect(envelope.data.transcript.id).toBe(RICK_ID);
  });

  // ── unknown tool ──────────────────────────────────────────────────────────

  test('bogus tool name → isError true, err envelope, engine not called', async () => {
    const { engine, calls } = makeFakeEngine();
    const result = await runTool(engine, 'bogus', {});
    expect(result.isError).toBe(true);
    const envelope = JSON.parse(result.content[0]?.text);
    expect(envelope.ok).toBe(false);
    // engine should not have been touched
    expect(calls.search).toHaveLength(0);
    expect(calls.getInfo).toHaveLength(0);
    expect(calls.getTranscript).toHaveLength(0);
  });
});
