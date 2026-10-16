import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  WriteInterruptedError,
  applyWritePlan,
  planWrites,
  relocateFiles,
} from './write-plan';

describe('write plan', () => {
  let root: string;

  async function put(path: string, content: string): Promise<void> {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content, 'utf8');
  }

  const resources = { path: 'src/app/resources.ts', content: 'resources\n' };
  const page = { path: 'src/app/pages/list.ts', content: 'page\n' };
  const helper = { path: 'src/app/pidrang/index.ts', content: 'helper\n' };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pidrang-write-plan-'));
    await mkdir(join(root, 'src/app'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe('planWrites', () => {
    it('plans to create every missing file', async () => {
      expect(await planWrites(root, [resources, page])).toEqual({
        create: [resources, page],
        unchanged: [],
        conflicts: [],
      });
    });

    it('leaves an identical file alone, Windows line endings included', async () => {
      await put(resources.path, 'resources\r\n');
      await put(page.path, page.content);

      expect(await planWrites(root, [resources, page, helper])).toEqual({
        create: [helper],
        unchanged: [resources, page],
        conflicts: [],
      });
    });

    it('reports a different file as a conflict', async () => {
      await put(page.path, 'edited by hand\n');

      expect(await planWrites(root, [resources, page])).toEqual({
        create: [resources],
        unchanged: [],
        conflicts: [
          {
            path: page.path,
            reason: 'differs from what this pidrang version generates',
          },
        ],
      });
    });

    it('reports a folder in the place of a file as a conflict', async () => {
      await mkdir(join(root, resources.path));

      expect((await planWrites(root, [resources])).conflicts).toEqual([
        {
          path: resources.path,
          reason: 'a folder or another non-file entry has this name',
        },
      ]);
    });

    it('reports a file in the place of a parent folder as a conflict', async () => {
      await put('src/app/pages', 'not a folder');

      expect((await planWrites(root, [page])).conflicts).toEqual([
        { path: page.path, reason: 'src/app/pages is a file, not a folder' },
      ]);
    });

    it('reports a file in the place of a deeper parent folder as a conflict', async () => {
      await rm(join(root, 'src/app'), { recursive: true });
      await put('src/app', 'not a folder');

      expect((await planWrites(root, [page])).conflicts).toEqual([
        { path: page.path, reason: 'src/app is a file, not a folder' },
      ]);
    });
  });

  describe('applyWritePlan', () => {
    it('writes every planned file and its folders, and nothing else', async () => {
      await put(resources.path, resources.content);
      const plan = await planWrites(root, [resources, page, helper]);

      expect(await applyWritePlan(root, plan)).toEqual([
        page.path,
        helper.path,
      ]);
      expect(await readFile(join(root, page.path), 'utf8')).toBe(page.content);
      expect(await readFile(join(root, helper.path), 'utf8')).toBe(
        helper.content,
      );
    });

    it('refuses a plan that still has conflicts', async () => {
      await put(page.path, 'edited by hand\n');
      const plan = await planWrites(root, [resources, page]);

      await expect(applyWritePlan(root, plan)).rejects.toThrow(
        'A write plan with conflicts cannot be applied.',
      );
      expect(await readdir(join(root, 'src/app'))).toEqual(['pages']);
    });

    it('writes nothing once cancelled and names what is left', async () => {
      const plan = await planWrites(root, [resources, page]);
      const controller = new AbortController();
      controller.abort();

      const error = await applyWritePlan(root, plan, controller.signal).catch(
        (err) => err,
      );
      expect(error).toBeInstanceOf(WriteInterruptedError);
      expect(error).toMatchObject({
        written: [],
        remaining: [resources.path, page.path],
        reason: 'cancelled',
      });
      expect(await readdir(join(root, 'src/app'))).toEqual([]);
    });

    it('stops without overwriting a file that appears after planning', async () => {
      const plan = await planWrites(root, [resources, page, helper]);
      await put(page.path, 'written meanwhile\n');

      const error = await applyWritePlan(root, plan).catch((err) => err);
      expect(error).toMatchObject({
        written: [resources.path],
        remaining: [page.path, helper.path],
        reason: `${page.path} appeared while pidrang was writing`,
      });
      expect(await readFile(join(root, page.path), 'utf8')).toBe(
        'written meanwhile\n',
      );
    });
  });

  describe('relocateFiles', () => {
    it('moves src/app files into the app folder of the workspace', () => {
      expect(
        relocateFiles([resources, page], 'projects/admin/src/app'),
      ).toEqual([
        { path: 'projects/admin/src/app/resources.ts', content: 'resources\n' },
        { path: 'projects/admin/src/app/pages/list.ts', content: 'page\n' },
      ]);
    });

    it('refuses a generated file outside src/app', () => {
      expect(() =>
        relocateFiles([{ path: 'README.md', content: '' }], 'src/app'),
      ).toThrow('Generated file outside src/app: README.md');
    });
  });
});
