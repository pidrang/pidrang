import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { layoutUiOf, loadAppTooling } from './app-tooling';

describe('loadAppTooling', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pidrang-tooling-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function fakeTypeScript(files: Record<string, string>): Promise<void> {
    await mkdir(join(root, 'node_modules/typescript/lib'), { recursive: true });
    await writeFile(
      join(root, 'node_modules/typescript/package.json'),
      JSON.stringify({ name: 'typescript', main: 'lib/version.cjs' }),
    );
    for (const [name, content] of Object.entries(files)) {
      await mkdir(dirname(join(root, 'node_modules/typescript', name)), {
        recursive: true,
      });
      await writeFile(join(root, 'node_modules/typescript', name), content);
    }
  }

  it('has no TypeScript when the app does not depend on it', async () => {
    await writeFile(join(root, 'package.json'), '{}');

    expect((await loadAppTooling(root)).typescript).toBeNull();
  });

  it('picks Tailwind when package.json depends on it', async () => {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { '@pidrang/tailwind': '^0.1.0' } }),
    );

    expect((await loadAppTooling(root)).layoutUi).toBe('tailwind');
  });

  it('picks Tailwind when only @pidrang/tailwind is installed', async () => {
    await writeFile(join(root, 'package.json'), '{}');
    await mkdir(join(root, 'node_modules/@pidrang/tailwind'), {
      recursive: true,
    });
    await writeFile(
      join(root, 'node_modules/@pidrang/tailwind/package.json'),
      JSON.stringify({ name: '@pidrang/tailwind' }),
    );

    expect((await loadAppTooling(root)).layoutUi).toBe('tailwind');
  });

  it('picks Material when the app has no @pidrang/tailwind', async () => {
    await writeFile(join(root, 'package.json'), '{}');

    expect((await loadAppTooling(root)).layoutUi).toBe('material');
  });

  it('has no TypeScript when the entry exposes no compiler API', async () => {
    await fakeTypeScript({
      'lib/version.cjs': 'module.exports = { version: "7.0.2" };',
    });

    expect((await loadAppTooling(root)).typescript).toBeNull();
  });
});

describe('layoutUiOf', () => {
  it.each([
    [
      'dependencies',
      JSON.stringify({ dependencies: { '@pidrang/tailwind': '^0.1.0' } }),
    ],
    [
      'devDependencies',
      JSON.stringify({ devDependencies: { '@pidrang/tailwind': '^0.1.0' } }),
    ],
  ])('picks Tailwind from %s', (_, manifest) => {
    expect(layoutUiOf(manifest)).toBe('tailwind');
  });

  it.each([
    ['no manifest', ''],
    [
      'a manifest without the package',
      '{"dependencies":{"@angular/core":"^22.1.0"}}',
    ],
    [
      'a package name it only mentions elsewhere',
      '{"name":"@pidrang/tailwind"}',
    ],
  ])('picks Material from %s', (_, manifest) => {
    expect(layoutUiOf(manifest)).toBe('material');
  });
});
