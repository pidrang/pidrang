import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadAppTooling } from './app-tooling';

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

  it('has no TypeScript when the entry exposes no compiler API', async () => {
    await fakeTypeScript({
      'lib/version.cjs': 'module.exports = { version: "7.0.2" };',
    });

    expect((await loadAppTooling(root)).typescript).toBeNull();
  });
});
