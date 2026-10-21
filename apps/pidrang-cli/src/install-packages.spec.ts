import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  detectPackageManager,
  formatCommand,
  installCommands,
  missingPackages,
  pinPackages,
  requiredPackages,
  spawnCommand,
} from './install-packages';

const UI_LAYER = {
  install: ['@pidrang/material'],
  ngAdd: ['@angular/material'],
};

let root: string;

async function put(files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content, 'utf8');
  }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pidrang-install-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('detectPackageManager', () => {
  it('falls back to npm without any hint', async () => {
    expect(await detectPackageManager(root)).toEqual({ manager: 'npm' });
  });

  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
  ])('reads %s as %s', async (lockfile, manager) => {
    await put({ [lockfile]: '' });

    expect(await detectPackageManager(root)).toEqual({ manager });
  });

  it('takes cli.packageManager of angular.json first', async () => {
    await put({
      'angular.json': JSON.stringify({ cli: { packageManager: 'yarn' } }),
      'package.json': JSON.stringify({ packageManager: 'pnpm@9.1.0' }),
      'package-lock.json': '',
    });

    expect(await detectPackageManager(root)).toEqual({ manager: 'yarn' });
  });

  it('takes the packageManager field of package.json before a lockfile', async () => {
    await put({
      'angular.json': JSON.stringify({ projects: {} }),
      'package.json': JSON.stringify({
        packageManager: 'pnpm@9.1.0+sha512.abc',
      }),
      'package-lock.json': '',
    });

    expect(await detectPackageManager(root)).toEqual({ manager: 'pnpm' });
  });

  it('reports a package manager it cannot run', async () => {
    await put({
      'angular.json': JSON.stringify({ cli: { packageManager: 'cnpm' } }),
    });

    expect(await detectPackageManager(root)).toEqual({ unsupported: 'cnpm' });
  });

  it('finds the lockfile of a workspace above the app, up to the git root', async () => {
    await put({
      '.git/HEAD': '',
      'pnpm-lock.yaml': '',
      'apps/shop/angular.json': '{}',
    });

    expect(await detectPackageManager(join(root, 'apps/shop'))).toEqual({
      manager: 'pnpm',
    });
  });

  it('prefers the closest lockfile', async () => {
    await put({
      '.git/HEAD': '',
      'pnpm-lock.yaml': '',
      'apps/shop/yarn.lock': '',
    });

    expect(await detectPackageManager(join(root, 'apps/shop'))).toEqual({
      manager: 'yarn',
    });
  });

  it('does not look above the git root', async () => {
    await put({ 'yarn.lock': '', 'shop/.git/HEAD': '' });

    expect(await detectPackageManager(join(root, 'shop'))).toEqual({
      manager: 'npm',
    });
  });

  it('looks only in the app folder outside a git repository', async () => {
    await put({ 'yarn.lock': '', 'shop/angular.json': '{}' });

    expect(await detectPackageManager(join(root, 'shop'))).toEqual({
      manager: 'npm',
    });
  });
});

describe('requiredPackages and pinPackages', () => {
  it('start with @pidrang/core, drop duplicates and pin only @pidrang packages', () => {
    const names = requiredPackages(
      ['@pidrang/core', '@pidrang/supabase', '@supabase/supabase-js'],
      UI_LAYER,
    );

    expect(pinPackages(names, '0.1.0')).toEqual([
      '@pidrang/core@0.1.0',
      '@pidrang/supabase@0.1.0',
      '@supabase/supabase-js',
      '@pidrang/material@0.1.0',
    ]);
  });
});

describe('missingPackages', () => {
  const NAMES = ['@pidrang/core', '@supabase/supabase-js', '@angular/material'];

  it('counts every package as missing in an app without them', async () => {
    await put({ 'package.json': JSON.stringify({ dependencies: {} }) });

    expect(await missingPackages(root, NAMES, '0.1.0')).toEqual(NAMES);
  });

  it('keeps a package that is declared and installed, @pidrang ones at the CLI version', async () => {
    await put({
      'package.json': JSON.stringify({
        dependencies: {
          '@pidrang/core': '^0.1.0',
          '@angular/material': '~22.2.0',
        },
        devDependencies: { '@supabase/supabase-js': '^2.0.0' },
      }),
      'node_modules/@pidrang/core/package.json': JSON.stringify({
        version: '0.1.0',
      }),
      'node_modules/@supabase/supabase-js/package.json': JSON.stringify({
        version: '2.1.0',
      }),
      'node_modules/@angular/material/package.json': JSON.stringify({
        version: '22.2.4',
      }),
    });

    expect(await missingPackages(root, NAMES, '0.1.0')).toEqual([]);
  });

  it('counts a @pidrang package at another version as missing', async () => {
    await put({
      'package.json': JSON.stringify({
        dependencies: { '@pidrang/core': '^0.1.0' },
      }),
      'node_modules/@pidrang/core/package.json': JSON.stringify({
        version: '0.1.0',
      }),
    });

    expect(await missingPackages(root, ['@pidrang/core'], '0.1.1')).toEqual([
      '@pidrang/core',
    ]);
  });

  it('counts a package declared but not installed, or installed but not declared, as missing', async () => {
    await put({
      'package.json': JSON.stringify({
        dependencies: { '@angular/material': '~22.2.0' },
      }),
      'node_modules/@supabase/supabase-js/package.json': JSON.stringify({
        version: '2.1.0',
      }),
    });

    expect(
      await missingPackages(
        root,
        ['@angular/material', '@supabase/supabase-js'],
        '0.1.0',
      ),
    ).toEqual(['@angular/material', '@supabase/supabase-js']);
  });
});

describe('installCommands', () => {
  it.each([
    ['npm', 'npm install a b', 'npx ng add @angular/material'],
    ['pnpm', 'pnpm add a b', 'pnpm exec ng add @angular/material'],
    ['yarn', 'yarn add a b', 'yarn ng add @angular/material'],
    ['bun', 'bun add a b', 'bunx ng add @angular/material'],
  ] as const)('builds the %s commands', (manager, install, ngAdd) => {
    expect(
      installCommands(manager, ['a', 'b'], ['@angular/material']).map(
        formatCommand,
      ),
    ).toEqual([install, ngAdd]);
  });

  it('leaves out what has nothing to do', () => {
    expect(
      installCommands('npm', [], ['@angular/material']).map(formatCommand),
    ).toEqual(['npx ng add @angular/material']);
    expect(installCommands('npm', ['a'], []).map(formatCommand)).toEqual([
      'npm install a',
    ]);
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
