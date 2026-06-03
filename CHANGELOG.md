# [1.3.0](https://github.com/gabros20/youtube-relay-mcp/compare/v1.2.0...v1.3.0) (2026-06-03)


### Features

* frame pure helpers + FrameExtractor interface (TDD) ([5e9a6f7](https://github.com/gabros20/youtube-relay-mcp/commit/5e9a6f71a5593a580df0d7e0bf9ee7fe3df55574)), closes [hi#res](https://github.com/hi/issues/res)
* real FrameExtractor (yt-dlp + ffmpeg/ffprobe) + create outDir + smoke ([2cd905e](https://github.com/gabros20/youtube-relay-mcp/commit/2cd905e959579e36be0ef0c65aa47be3034a9c1f))
* runFrame command (DI, deps-check, batch, per-frame error isolation) ([4e55ae5](https://github.com/gabros20/youtube-relay-mcp/commit/4e55ae520e09ba7490f32c4a49c26f209e049bee))
* wire frame command into CLI + MCP + registry + docs ([63a5012](https://github.com/gabros20/youtube-relay-mcp/commit/63a50121893b48c702fa322ed02b9c73313df2f9))

# [1.2.0](https://github.com/gabros20/youtube-relay-mcp/compare/v1.1.0...v1.2.0) (2026-06-03)


### Bug Fixes

* applyMaxChars slices first segment instead of empty string; parseChapters handles 3-digit minutes ([3655fe9](https://github.com/gabros20/youtube-relay-mcp/commit/3655fe982f6c86590054d85beabc60884e7d64ab))


### Features

* CLI search filters, transcript peek flags, batch ids + stdin ([4c7967c](https://github.com/gabros20/youtube-relay-mcp/commit/4c7967c4587765c610a210a0199d8251772e38f4))
* enriched search signals, filters + pagination, info captions/chapters, peek helpers ([c70c11d](https://github.com/gabros20/youtube-relay-mcp/commit/c70c11d9d92e00e8608a166e50da02b46837624a))
* MCP parity for new options + rewrite SKILL.md as research funnel + docs ([3c1d02e](https://github.com/gabros20/youtube-relay-mcp/commit/3c1d02e731ec63943be556e960c33a5fc43cf494))
* search filter passthrough + transcript peek (--head/--max-chars) in commands ([4b8a12b](https://github.com/gabros20/youtube-relay-mcp/commit/4b8a12b67ad41075c1b1f355acb90b259c0d3ab1))

# [1.1.0](https://github.com/gabros20/youtube-relay-mcp/compare/v1.0.0...v1.1.0) (2026-06-02)


### Features

* fetch transcripts via signed timedtext caption URL (no PO token) ([59093ac](https://github.com/gabros20/youtube-relay-mcp/commit/59093ac95c0fbd74bd5f1b3d0d7ee30d6524ab5f))

# 1.0.0 (2026-06-02)


### Bug Fixes

* correctly classify youtubei.js no-captions errors vs network failures ([e2af33e](https://github.com/gabros20/youtube-relay-mcp/commit/e2af33ed7bdcfff3bfd2024b05f991fffa809d44))
* honest transcript-limitation hint (PO-token wall, not just proxy) ([bbc594f](https://github.com/gabros20/youtube-relay-mcp/commit/bbc594f8e020ef751bcb515a7b81608a9ccddcce))
* windows-safe cli entry guard, typed import.meta.main, omit empty --lang ([74ab541](https://github.com/gabros20/youtube-relay-mcp/commit/74ab54126aca3e2a07096f853b64d7ca5257f952))


### Features

* add core types, id/url helpers, output envelope, command registry, and skill-gen ([9d06490](https://github.com/gabros20/youtube-relay-mcp/commit/9d064906e143db454b300c4d7c78294fa3469c1f))
* add MCP shim exposing the four commands as tools ([ae61527](https://github.com/gabros20/youtube-relay-mcp/commit/ae6152785f2c880f09835dccdc3fda66734b02ff))
* add search/info/transcript/context command runners ([1e296fd](https://github.com/gabros20/youtube-relay-mcp/commit/1e296fd7507a6dcd9d907ec53cbf64db4b684a94))
* add youtubei.js engine wrapper with pure normalizers ([4744b89](https://github.com/gabros20/youtube-relay-mcp/commit/4744b89584b049c43acb5925deed3eeeead3665e))
* add ytrelay CLI entry with arg parsing and dispatch ([30a4a87](https://github.com/gabros20/youtube-relay-mcp/commit/30a4a87f387f78410b87aa6f49a30eb8550bc139))
