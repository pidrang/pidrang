import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findStaleSignInFiles } from './find-stale-sign-in-files';

describe('findStaleSignInFiles', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pidrang-cli-test-'));
    await mkdir(join(root, 'src/app/pidrang'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const state = {
    path: 'src/app/pidrang/sign-in-url.ts',
    content: 'export function injectSignInUrl() {}',
  };

  it('lists a kept file that predates the sign-in URL', async () => {
    await writeFile(join(root, state.path), '<a routerLink="/login">', 'utf8');

    expect(await findStaleSignInFiles(root, [state])).toEqual([state.path]);
  });

  it('ignores a kept file that already reads the sign-in URL', async () => {
    await writeFile(join(root, state.path), state.content, 'utf8');

    expect(await findStaleSignInFiles(root, [state])).toEqual([]);
  });

  it('lists a kept page that still links to /login', async () => {
    const page = {
      path: 'src/app/pages/resource-list-page.ts',
      content: 'protected readonly signInUrl = injectSignInUrl();',
    };
    await mkdir(join(root, 'src/app/pages'), { recursive: true });
    await writeFile(
      join(root, page.path),
      '<a routerLink="/login">sign in</a>',
      'utf8',
    );

    expect(await findStaleSignInFiles(root, [page])).toEqual([page.path]);
  });

  it('lists a kept barrel that does not export the sign-in URL yet', async () => {
    const barrel = {
      path: 'src/app/pidrang/index.ts',
      content: "export * from './save-lock';\nexport * from './sign-in-url';\n",
    };
    await writeFile(
      join(root, barrel.path),
      "export * from './save-lock';\n",
      'utf8',
    );

    expect(await findStaleSignInFiles(root, [barrel])).toEqual([barrel.path]);
  });

  it('ignores a kept file the sign-in URL never concerned', async () => {
    const label = {
      path: 'src/app/pidrang/record-label.ts',
      content: 'export {}',
    };
    await writeFile(join(root, label.path), 'old', 'utf8');

    expect(await findStaleSignInFiles(root, [label])).toEqual([]);
  });
});
