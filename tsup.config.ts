import { readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

// Map of entry file → the exported main function name in that module.
const EXEC_ENTRIES: Record<string, string> = {
  'dist/cli.js': 'main',
  'dist/mcp-shim.js': 'main',
};

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    'mcp-shim': 'src/mcp-shim.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node18',
  splitting: true,
  sourcemap: true,
  outDir: 'dist',
  async onSuccess() {
    // With splitting: true tsup creates a thin re-export stub for each entry.
    // The isEntry guard in the shared chunk never fires because import.meta.url
    // points to the chunk file, not the entry. Patch each executable entry to:
    //   1. Add the shebang line.
    //   2. Export a main() that the chunk's main() delegates to — but more
    //      importantly, invoke it when this file is the direct argv[1] entry.
    for (const file of Object.keys(EXEC_ENTRIES)) {
      let body = readFileSync(file, 'utf-8');
      if (!body.startsWith('#!')) {
        body = `#!/usr/bin/env node\n${body}`;
      }
      // Inject a direct entry-point runner after the re-exports.
      // We re-export `main` from the chunk, then call it when argv[1] matches.
      const entryRunner =
        '\n// ── Entry runner (injected by tsup onSuccess) ──────────────\n' +
        'import { fileURLToPath as __fup } from "url";\n' +
        'if (process.argv[1] && __fup(import.meta.url) === process.argv[1]) {\n' +
        '  await main();\n' +
        '}\n';
      if (!body.includes('Entry runner')) {
        body += entryRunner;
      }
      writeFileSync(file, body);
    }
  },
});
