import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const tarballDirectory = resolve(
  root,
  process.env['PIDRANG_TARBALLS'] ?? 'tmp/tarballs',
);

export const packages = [
  {
    project: 'core',
    source: 'libs/core',
    name: '@pidrang/core',
    dist: 'dist/libs/core',
  },
  {
    project: 'supabase',
    source: 'libs/supabase',
    name: '@pidrang/supabase',
    dist: 'dist/libs/supabase',
  },
  {
    project: 'material',
    source: 'libs/material',
    name: '@pidrang/material',
    dist: 'dist/libs/material',
  },
  {
    project: 'tailwind',
    source: 'libs/tailwind',
    name: '@pidrang/tailwind',
    dist: 'dist/libs/tailwind',
  },
  {
    project: 'cli',
    source: 'libs/cli',
    name: '@pidrang/cli',
    dist: 'dist/libs/cli',
  },
  {
    project: 'cli-supabase',
    source: 'libs/cli-supabase',
    name: '@pidrang/cli-supabase',
    dist: 'dist/libs/cli-supabase',
  },
  {
    project: 'pidrang-cli',
    source: 'apps/pidrang-cli',
    name: 'pidrang',
    dist: 'dist/apps/pidrang-cli',
  },
];

export function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  });
}
