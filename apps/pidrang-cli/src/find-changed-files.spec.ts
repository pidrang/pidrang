import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findChangedFiles } from './find-changed-files';

describe('findChangedFiles', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pidrang-cli-test-'));
    await mkdir(join(root, 'src/app/pidrang'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('lists only the kept files that differ from what init generates now', async () => {
    const same = { path: 'src/app/pidrang/record-label.ts', content: 'same' };
    const changed = { path: 'src/app/pidrang/save-failure.ts', content: 'new' };
    await writeFile(join(root, same.path), 'same', 'utf8');
    await writeFile(join(root, changed.path), 'old', 'utf8');

    expect(await findChangedFiles(root, [same, changed])).toEqual([
      changed.path,
    ]);
  });

  it('does not count Windows line endings as a change', async () => {
    const file = { path: 'src/app/pidrang/record-label.ts', content: 'a\nb\n' };
    await writeFile(join(root, file.path), 'a\r\nb\r\n', 'utf8');

    expect(await findChangedFiles(root, [file])).toEqual([]);
  });
});
