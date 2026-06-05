import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'ace');

const CI_FILE = '.github/workflows/ci.yml';

// Relative paths in the payload that should never be copied into a user's project.
const EXCLUDED_PATHS = new Set([
  'README.md',    // ACE's own top-level docs; would clobber the project's README
]);

// Filenames to skip at any depth.
const EXCLUDED_NAMES = new Set(['.DS_Store']);

function* walkDir(dir, base = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* walkDir(join(dir, entry.name), rel);
    else yield rel;
  }
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function copyFile(srcPath, destPath) {
  mkdirSync(dirname(destPath), { recursive: true });
  copyFileSync(srcPath, destPath);
}

/**
 * Copy ACE files into dest. Skips existing files unless force is set.
 * @param {string} dest  Destination directory path.
 * @param {{ force?: boolean, includeCi?: boolean }} opts
 * @returns {{ path: string, status: 'copied'|'skipped' }[]}
 */
export function install(dest, { force = false, includeCi = true } = {}) {
  const results = [];

  for (const rel of walkDir(DATA_ROOT)) {
    if (EXCLUDED_PATHS.has(rel) || EXCLUDED_NAMES.has(rel.split('/').pop())) continue;

    if (!includeCi && rel === CI_FILE) {
      results.push({ path: rel, status: 'skipped' });
      continue;
    }

    const srcPath = join(DATA_ROOT, rel);
    const destPath = join(dest, rel);

    if (!existsSync(destPath) || force) {
      copyFile(srcPath, destPath);
      results.push({ path: rel, status: 'copied' });
    } else {
      results.push({ path: rel, status: 'skipped' });
    }
  }

  return results;
}

/**
 * Re-copy ACE files into dest. Files that have been locally modified are
 * skipped (warned) unless force is set.
 * @param {string} dest  Destination directory path.
 * @param {{ force?: boolean }} opts
 * @returns {{ path: string, status: 'copied'|'updated'|'warned' }[]}
 */
export function update(dest, { force = false } = {}) {
  const results = [];

  for (const rel of walkDir(DATA_ROOT)) {
    if (EXCLUDED_PATHS.has(rel) || EXCLUDED_NAMES.has(rel.split('/').pop())) continue;

    const srcPath = join(DATA_ROOT, rel);
    const destPath = join(dest, rel);

    if (!existsSync(destPath)) {
      copyFile(srcPath, destPath);
      results.push({ path: rel, status: 'copied' });
      continue;
    }

    const srcHash = sha256(srcPath);
    const destHash = sha256(destPath);

    if (srcHash === destHash || force) {
      copyFile(srcPath, destPath);
      results.push({ path: rel, status: 'updated' });
    } else {
      results.push({ path: rel, status: 'warned' });
    }
  }

  return results;
}
