import type { TranscriptResult, VideoInfo, VideoSummary } from '../../src/types.ts';
import type { Engine } from '../../src/youtube.ts';

export type FakeEngineConfig = {
  searchResult?: VideoSummary[];
  infoResult?: VideoInfo;
  transcriptResult?: TranscriptResult;
  searchThrows?: Error;
  infoThrows?: Error;
  transcriptThrows?: Error;
};

export type FakeEngineCalls = {
  search: { query: string; limit?: number }[];
  getInfo: string[];
  getTranscript: { id: string; lang?: string }[];
};

export function makeFakeEngine(cfg: FakeEngineConfig = {}): {
  engine: Engine;
  calls: FakeEngineCalls;
} {
  const calls: FakeEngineCalls = { search: [], getInfo: [], getTranscript: [] };

  const engine: Engine = {
    async search(query, opts) {
      calls.search.push({ query, limit: opts?.limit });
      if (cfg.searchThrows) throw cfg.searchThrows;
      return cfg.searchResult ?? [];
    },
    async getInfo(id) {
      calls.getInfo.push(id);
      if (cfg.infoThrows) throw cfg.infoThrows;
      return cfg.infoResult ?? stubInfo(id);
    },
    async getTranscript(id, lang) {
      calls.getTranscript.push({ id, lang });
      if (cfg.transcriptThrows) throw cfg.transcriptThrows;
      return cfg.transcriptResult ?? stubTranscript(id, lang ?? null);
    },
  };

  return { engine, calls };
}

export function stubInfo(id: string): VideoInfo {
  return {
    id,
    title: `Title of ${id}`,
    description: `Description of ${id}`,
    channel: 'Fake Channel',
    duration: '1:23',
    url: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
  };
}

export function stubTranscript(id: string, lang: string | null): TranscriptResult {
  return {
    id,
    lang: lang ?? 'en',
    source: 'innertube',
    transcript: 'Hello world',
    segments: [{ text: 'Hello world', startMs: 0, durationMs: 1000 }],
  };
}
