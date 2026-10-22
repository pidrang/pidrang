import { lstat, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { GeneratedFile } from '@pidrang/cli';

export interface WriteConflict {
  path: string;
  reason: string;
}

export interface FileEditPlan {
  path: string;
  before: string;
  after: string;
  manual: boolean;
  reason?: string;
}

export interface WritePlan {
  create: GeneratedFile[];
  unchanged: GeneratedFile[];
  conflicts: WriteConflict[];
  edits?: FileEditPlan[];
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

type Entry = 'missing' | 'file' | 'other' | 'broken-link';

function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

async function entryAt(path: string): Promise<Entry> {
  let entry;
  try {
    entry = await lstat(path);
  } catch (error) {
    if (isMissing(error)) {
      return 'missing';
    }
    throw error;
  }
  if (entry.isSymbolicLink()) {
    try {
      entry = await stat(path);
    } catch (error) {
      if (isMissing(error)) {
        return 'broken-link';
      }
      throw error;
    }
  }
  return entry.isFile() ? 'file' : 'other';
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
      return `${parent} is a file, not a folder`;
    }
    if (entry === 'broken-link') {
      return `${parent} is a link to something that does not exist`;
    }
    if (entry === 'other') {
      return null;
    }
  }
  return null;
}

export async function conflictReason(
  root: string,
  file: GeneratedFile,
): Promise<string | null | 'unchanged'> {
  const entry = await entryAt(join(root, file.path));
  if (entry === 'other') {
    return 'a folder or another non-file entry has this name';
  }
  if (entry === 'broken-link') {
    return 'a link to something that does not exist has this name';
  }
  if (entry === 'file') {
    const existing = await readFile(join(root, file.path), 'utf8');
    return existing.replace(/\r\n/g, '\n') === file.content
      ? 'unchanged'
      : 'differs from what this pidrang version generates';
  }
  return blockedParent(root, file.path);
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

export type EditCandidate = FileEditPlan;

export async function planEdits(
  root: string,
  candidates: EditCandidate[],
): Promise<{ edits: FileEditPlan[]; conflicts: WriteConflict[] }> {
  const plan = {
    edits: [] as FileEditPlan[],
    conflicts: [] as WriteConflict[],
  };
  for (const candidate of candidates) {
    let current: string;
    try {
      current = await readFile(join(root, candidate.path), 'utf8');
    } catch {
      plan.conflicts.push({
        path: candidate.path,
        reason: 'disappeared while pidrang was reading the app',
      });
      continue;
    }
    if (
      current.replace(/\r\n/g, '\n') !== candidate.before.replace(/\r\n/g, '\n')
    ) {
      plan.conflicts.push({
        path: candidate.path,
        reason: 'changed while pidrang was reading the app',
      });
      continue;
    }
    plan.edits.push(candidate);
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
  const edits = plan.edits ?? [];
  const written: string[] = [];
  const remaining = () => [
    ...plan.create.slice(written.length).map((file) => file.path),
    ...edits
      .slice(Math.max(0, written.length - plan.create.length))
      .map((file) => file.path),
  ];
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
  for (const edit of edits) {
    if (signal?.aborted) {
      throw new WriteInterruptedError(written, remaining(), 'cancelled');
    }
    let current: string;
    try {
      current = await readFile(join(root, edit.path), 'utf8');
    } catch {
      throw new WriteInterruptedError(
        written,
        remaining(),
        `${edit.path} disappeared while pidrang was writing`,
      );
    }
    if (current.replace(/\r\n/g, '\n') !== edit.before.replace(/\r\n/g, '\n')) {
      throw new WriteInterruptedError(
        written,
        remaining(),
        `${edit.path} changed while pidrang was writing`,
      );
    }
    const content = current.includes('\r\n')
      ? edit.after.replace(/\n/g, '\r\n')
      : edit.after;
    try {
      await writeFile(join(root, edit.path), content, 'utf8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      throw new WriteInterruptedError(
        written,
        remaining(),
        `could not write ${edit.path} (${code ?? 'unknown error'})`,
      );
    }
    written.push(edit.path);
  }
  return written;
}
