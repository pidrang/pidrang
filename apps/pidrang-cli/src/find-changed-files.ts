import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GeneratedFile } from '@pidrang/cli';

export async function findChangedFiles(
  root: string,
  keptFiles: GeneratedFile[],
): Promise<string[]> {
  const changed: string[] = [];
  for (const file of keptFiles) {
    const kept = await readFile(join(root, file.path), 'utf8');
    if (kept.replace(/\r\n/g, '\n') !== file.content) {
      changed.push(file.path);
    }
  }
  return changed;
}
