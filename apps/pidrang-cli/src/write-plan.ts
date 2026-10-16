import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { GeneratedFile } from '@pidrang/cli';

export interface WriteConflict {
  path: string;
  reason: string;
}

export interface WritePlan {
  create: GeneratedFile[];
  unchanged: GeneratedFile[];
  conflicts: WriteConflict[];
}

export class WriteInterruptedError extends Error {
  constructor(
    readonly written: string[],
    readonly remaining: string[],
    readonly reason: string,
  ) {
    super(`Writing stopped: ${reason}.`);
    this.name = 'WriteInterruptedError';
  }
}

type Entry = 'missing' | 'file' | 'other';

async function entryAt(path: string): Promise<Entry> {
  try {
    return (await stat(path)).isFile() ? 'file' : 'other';
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return 'missing';
    }
    throw error;
  }
}

async function blockedParent(
  root: string,
  path: string,
): Promise<string | null> {
  for (
    let parent = posix.dirname(path);
    parent !== '.' && parent !== '/';
    parent = posix.dirname(parent)
  ) {
    const entry = await entryAt(join(root, parent));
    if (entry === 'file') {
      return parent;
    }
    if (entry === 'other') {
      return null;
    }
  }
  return null;
}

async function conflictReason(
  root: string,
  file: GeneratedFile,
): Promise<string | null | 'unchanged'> {
  const entry = await entryAt(join(root, file.path));
  if (entry === 'other') {
    return 'a folder or another non-file entry has this name';
  }
  if (entry === 'file') {
    const existing = await readFile(join(root, file.path), 'utf8');
    return existing.replace(/\r\n/g, '\n') === file.content
      ? 'unchanged'
      : 'differs from what this pidrang version generates';
  }
  const parent = await blockedParent(root, file.path);
  return parent ? `${parent} is a file, not a folder` : null;
}

export function relocateFiles(
  files: GeneratedFile[],
  appDirectory: string,
): GeneratedFile[] {
  return files.map((file) => {
    if (!file.path.startsWith('src/app/')) {
      throw new Error(`Generated file outside src/app: ${file.path}`);
    }
    return {
      ...file,
      path: posix.join(appDirectory, file.path.slice('src/app/'.length)),
    };
  });
}

export async function planWrites(
  root: string,
  files: GeneratedFile[],
): Promise<WritePlan> {
  const plan: WritePlan = { create: [], unchanged: [], conflicts: [] };
  for (const file of files) {
    const reason = await conflictReason(root, file);
    if (reason === null) {
      plan.create.push(file);
    } else if (reason === 'unchanged') {
      plan.unchanged.push(file);
    } else {
      plan.conflicts.push({ path: file.path, reason });
    }
  }
  return plan;
}

export async function applyWritePlan(
  root: string,
  plan: WritePlan,
  signal?: AbortSignal,
): Promise<string[]> {
  if (plan.conflicts.length > 0) {
    throw new Error('A write plan with conflicts cannot be applied.');
  }
  const written: string[] = [];
  const remaining = () =>
    plan.create.slice(written.length).map((file) => file.path);
  for (const file of plan.create) {
    if (signal?.aborted) {
      throw new WriteInterruptedError(written, remaining(), 'cancelled');
    }
    const fullPath = join(root, file.path);
    try {
      await mkdir(join(fullPath, '..'), { recursive: true });
      await writeFile(fullPath, file.content, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      throw new WriteInterruptedError(
        written,
        remaining(),
        code === 'EEXIST'
          ? `${file.path} appeared while pidrang was writing`
          : `could not write ${file.path} (${code ?? 'unknown error'})`,
      );
    }
    written.push(file.path);
  }
  return written;
}
