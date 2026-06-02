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
