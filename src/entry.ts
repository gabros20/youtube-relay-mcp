import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Resolves a path to its canonical location on disk. Injectable for tests. */
export type RealpathFn = (path: string) => string;

/**
 * True when `moduleUrl` names the file the process was actually started with.
 *
 * Both sides are canonicalised before comparison. That matters for a global npm
 * install: the bin on PATH is a symlink into the package's `dist/`, and Node
 * reports the symlink path in `process.argv[1]` while `import.meta.url` points
 * at the real file. Comparing them raw never matches, so the entry guard falls
 * through and the CLI exits 0 having done nothing.
 */
export function isEntryPoint(
  moduleUrl: string,
  argv1: string | undefined,
  realpath: RealpathFn = realpathSync,
): boolean {
  if (argv1 === undefined) return false;
  try {
    return realpath(argv1) === realpath(fileURLToPath(moduleUrl));
  } catch {
    // A path that cannot be resolved (deleted, permission denied) is not our entry.
    return false;
  }
}
