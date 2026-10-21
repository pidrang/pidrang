import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detectPackageManager,
  formatCommand,
  installCommands,
  packagesToInstall,
  spawnCommand,
} from './install-packages';

const UI_LAYER = {
  install: ['@pidrang/material'],
  ngAdd: ['@angular/material'],
};

describe('detectPackageManager', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pidrang-install-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('falls back to npm without a lockfile', async () => {
    expect(await detectPackageManager(root)).toBe('npm');
  });

  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
  ])('reads %s as %s', async (lockfile, manager) => {
    await writeFile(join(root, lockfile), '');

    expect(await detectPackageManager(root)).toBe(manager);
  });
});

describe('packagesToInstall', () => {
  it('starts with @pidrang/core, pins only @pidrang packages and drops duplicates', () => {
    expect(
      packagesToInstall(
        ['@pidrang/core', '@pidrang/supabase', '@supabase/supabase-js'],
        UI_LAYER,
        '0.1.0',
      ),
    ).toEqual([
      '@pidrang/core@0.1.0',
      '@pidrang/supabase@0.1.0',
      '@supabase/supabase-js',
      '@pidrang/material@0.1.0',
    ]);
  });
});

describe('installCommands', () => {
  it.each([
    ['npm', 'npm install a b', 'npx ng add @angular/material'],
    ['pnpm', 'pnpm add a b', 'pnpm exec ng add @angular/material'],
    ['yarn', 'yarn add a b', 'yarn ng add @angular/material'],
  ] as const)('builds the %s commands', (manager, install, ngAdd) => {
    expect(
      installCommands(manager, ['a', 'b'], UI_LAYER).map(formatCommand),
    ).toEqual([install, ngAdd]);
  });
});

describe('spawnCommand', () => {
  it('reports the exit status of the command', async () => {
    const run = spawnCommand(tmpdir());

    expect(
      await run({ command: process.execPath, args: ['-e', 'process.exit(0)'] }),
    ).toBe(true);
    expect(
      await run({ command: process.execPath, args: ['-e', 'process.exit(3)'] }),
    ).toBe(false);
  });

  it('reports a command that cannot start as a failure', async () => {
    expect(
      await spawnCommand(tmpdir())({
        command: 'pidrang-no-such-command',
        args: [],
      }),
    ).toBe(false);
  });
});
