import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { GeneratedFile } from '@pidrang/cli';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function writeGeneratedFile(
  root: string,
  file: GeneratedFile,
): Promise<'written' | 'skipped'> {
  const fullPath = join(root, file.path);
  if (await fileExists(fullPath)) {
    return 'skipped';
  }
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, file.content, 'utf8');
  return 'written';
}
