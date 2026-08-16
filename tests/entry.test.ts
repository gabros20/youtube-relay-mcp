import { describe, expect, test } from 'bun:test';
import { isEntryPoint } from '../src/entry';

// Simulates a global npm install under fnm: the bin on PATH is a symlink into
// the package's dist/. Node sets process.argv[1] to the symlink path it was
// invoked through, while import.meta.url resolves to the real file.
const BIN_SYMLINK = '/home/u/.local/state/fnm_multishells/1_1/bin/ytrelay';
const REAL_CLI =
  '/home/u/.local/share/fnm/node-versions/v22.11.0/installation/lib/node_modules/youtube-relay-mcp/dist/cli.js';
const REAL_CLI_URL = `file://${REAL_CLI}`;

/** Fake realpath: resolves the bin symlink to the real dist file, else identity. */
const resolve = (p: string): string => (p === BIN_SYMLINK ? REAL_CLI : p);

describe('isEntryPoint', () => {
  test('is true when invoked through a symlinked npm bin', () => {
    expect(isEntryPoint(REAL_CLI_URL, BIN_SYMLINK, resolve)).toBe(true);
  });

  test('is true when the real file is invoked directly', () => {
    expect(isEntryPoint(REAL_CLI_URL, REAL_CLI, resolve)).toBe(true);
  });

  test('is false when the module is imported by another entry point', () => {
    expect(isEntryPoint(REAL_CLI_URL, '/home/u/project/some-other-script.js', resolve)).toBe(false);
  });

  test('is false when there is no argv[1] (e.g. `node -e`)', () => {
    expect(isEntryPoint(REAL_CLI_URL, undefined, resolve)).toBe(false);
  });

  test('is false rather than throwing when argv[1] no longer exists on disk', () => {
    const throwing = (p: string): string => {
      if (p === '/deleted/script.js') throw new Error('ENOENT');
      return p;
    };
    expect(isEntryPoint(REAL_CLI_URL, '/deleted/script.js', throwing)).toBe(false);
  });

  test('handles a file:// URL with percent-encoded characters', () => {
    const spaced = '/home/u/my projects/dist/cli.js';
    expect(isEntryPoint('file:///home/u/my%20projects/dist/cli.js', spaced, (p) => p)).toBe(true);
  });
});
