import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeGeneratedFile } from './write-generated-file';

describe('writeGeneratedFile', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pidrang-cli-test-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes a new file, creating parent directories', async () => {
    const result = await writeGeneratedFile(root, {
      path: 'src/app/pages/resource-list-page.ts',
      content: 'export {}',
    });

    expect(result).toBe('written');
    expect(
      await readFile(join(root, 'src/app/pages/resource-list-page.ts'), 'utf8'),
    ).toBe('export {}');
  });

  it('skips and does not overwrite a file that already exists', async () => {
    const target = join(root, 'src/app/resources.ts');
    await mkdir(join(root, 'src/app'), { recursive: true });
    await writeFile(target, 'not touched', 'utf8');

    const result = await writeGeneratedFile(root, {
      path: 'src/app/resources.ts',
      content: 'overwritten',
    });

    expect(result).toBe('skipped');
    expect(await readFile(target, 'utf8')).toBe('not touched');
  });
});
