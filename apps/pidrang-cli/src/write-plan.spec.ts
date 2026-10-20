import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  FileEditPlan,
  WriteInterruptedError,
  applyWritePlan,
  planEdits,
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

  describe('planWrites with links', () => {
    it('reports a link to nothing in the place of a file as a conflict', async () => {
      await symlink(join(root, 'nowhere.ts'), join(root, resources.path));

      expect((await planWrites(root, [resources])).conflicts).toEqual([
        {
          path: resources.path,
          reason: 'a link to something that does not exist has this name',
        },
      ]);
    });

    it('reports a link to nothing in the place of a parent folder as a conflict', async () => {
      await symlink(join(root, 'nowhere'), join(root, 'src/app/pages'));

      expect((await planWrites(root, [page])).conflicts).toEqual([
        {
          path: page.path,
          reason: 'src/app/pages is a link to something that does not exist',
        },
      ]);
    });

    it('compares a linked file by the content it points to', async () => {
      await put('elsewhere/same.ts', resources.content);
      await put('elsewhere/other.ts', 'other\n');
      await symlink(
        join(root, 'elsewhere/same.ts'),
        join(root, resources.path),
      );
      await mkdir(join(root, 'src/app/pages'));
      await symlink(join(root, 'elsewhere/other.ts'), join(root, page.path));

      expect(await planWrites(root, [resources, page])).toEqual({
        create: [],
        unchanged: [resources],
        conflicts: [
          {
            path: page.path,
            reason: 'differs from what this pidrang version generates',
          },
        ],
      });
    });

    it('writes through a parent folder that is a link to a folder', async () => {
      await mkdir(join(root, 'elsewhere/pages'), { recursive: true });
      await symlink(join(root, 'elsewhere/pages'), join(root, 'src/app/pages'));
      const plan = await planWrites(root, [page]);

      expect(await applyWritePlan(root, plan)).toEqual([page.path]);
      expect(
        await readFile(join(root, 'elsewhere/pages/list.ts'), 'utf8'),
      ).toBe(page.content);
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

  describe('planEdits', () => {
    const edit: FileEditPlan = {
      path: 'src/app/app.routes.ts',
      before: 'routes before\n',
      after: 'routes after\n',
      manual: false,
    };

    it('accepts a file that still has the content pidrang read', async () => {
      await put(edit.path, edit.before);

      expect(await planEdits(root, [edit])).toEqual({
        edits: [edit],
        conflicts: [],
      });
    });

    it('accepts a file that differs only by its line endings', async () => {
      await put(edit.path, edit.before.replace(/\n/g, '\r\n'));

      expect((await planEdits(root, [edit])).conflicts).toEqual([]);
    });

    it('reports a file that changed since pidrang read it', async () => {
      await put(edit.path, 'routes changed by hand\n');

      expect(await planEdits(root, [edit])).toEqual({
        edits: [],
        conflicts: [
          {
            path: edit.path,
            reason: 'changed while pidrang was reading the app',
          },
        ],
      });
    });

    it('reports a file that disappeared since pidrang read it', async () => {
      expect(await planEdits(root, [edit])).toEqual({
        edits: [],
        conflicts: [
          {
            path: edit.path,
            reason: 'disappeared while pidrang was reading the app',
          },
        ],
      });
    });
  });

  describe('applyWritePlan with edits', () => {
    const edit: FileEditPlan = {
      path: 'src/app/app.config.ts',
      before: 'config before\n',
      after: 'config after\n',
      manual: false,
    };

    it('applies the edits after the created files', async () => {
      await put(edit.path, edit.before);
      const planned = await planWrites(root, [resources]);
      const writePlan = {
        ...planned,
        edits: (await planEdits(root, [edit])).edits,
      };

      expect(await applyWritePlan(root, writePlan)).toEqual([
        resources.path,
        edit.path,
      ]);
      expect(await readFile(join(root, edit.path), 'utf8')).toBe(edit.after);
      expect(await readFile(join(root, resources.path), 'utf8')).toBe(
        resources.content,
      );
    });

    it('applies the edits when there is nothing to create', async () => {
      await put(edit.path, edit.before);

      expect(
        await applyWritePlan(root, {
          create: [],
          unchanged: [],
          conflicts: [],
          edits: [edit],
        }),
      ).toEqual([edit.path]);
      expect(await readFile(join(root, edit.path), 'utf8')).toBe(edit.after);
    });

    it('keeps the Windows line endings of an edited file', async () => {
      await put(edit.path, 'config before\r\n');
      const crlfEdit = { ...edit, after: 'config before\none more\n' };

      await applyWritePlan(root, {
        create: [],
        unchanged: [],
        conflicts: [],
        edits: [crlfEdit],
      });

      expect(await readFile(join(root, edit.path), 'utf8')).toBe(
        'config before\r\none more\r\n',
      );
    });

    it('stops without overwriting an edited file that changed after planning', async () => {
      await put(edit.path, edit.before);
      const writePlan = {
        ...(await planWrites(root, [resources])),
        edits: [edit],
      };
      await put(edit.path, 'written meanwhile\n');

      const error = await applyWritePlan(root, writePlan).catch((err) => err);
      expect(error).toMatchObject({
        written: [resources.path],
        remaining: [edit.path],
        reason: `${edit.path} changed while pidrang was writing`,
      });
      expect(await readFile(join(root, edit.path), 'utf8')).toBe(
        'written meanwhile\n',
      );
    });

    it('names the edits that are left once cancelled', async () => {
      await put(edit.path, edit.before);
      const controller = new AbortController();
      controller.abort();

      const error = await applyWritePlan(
        root,
        {
          create: [resources],
          unchanged: [],
          conflicts: [],
          edits: [edit],
        },
        controller.signal,
      ).catch((err) => err);
      expect(error).toMatchObject({
        written: [],
        remaining: [resources.path, edit.path],
        reason: 'cancelled',
      });
      expect(await readFile(join(root, edit.path), 'utf8')).toBe(edit.before);
    });

    it('names the edits that are left when a create fails', async () => {
      await put(edit.path, edit.before);
      const writePlan = { ...(await planWrites(root, [page])), edits: [edit] };
      await put(page.path, 'written meanwhile\n');

      const error = await applyWritePlan(root, writePlan).catch((err) => err);
      expect(error).toMatchObject({
        written: [],
        remaining: [page.path, edit.path],
      });
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
