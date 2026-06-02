import { readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

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
    // Add shebang to the executable entry points so they run via `npx`/global bin.
    for (const file of ['dist/cli.js', 'dist/mcp-shim.js']) {
      const body = readFileSync(file, 'utf-8');
      if (!body.startsWith('#!')) {
        writeFileSync(file, `#!/usr/bin/env node\n${body}`);
      }
    }
  },
});
