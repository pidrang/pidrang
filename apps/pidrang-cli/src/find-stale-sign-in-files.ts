import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GeneratedFile } from '@pidrang/cli';

const SIGN_IN_URL = /signInUrl|sign-in-url/i;

export async function findStaleSignInFiles(
  root: string,
  keptFiles: GeneratedFile[],
): Promise<string[]> {
  const stale: string[] = [];
  for (const file of keptFiles) {
    if (!SIGN_IN_URL.test(file.content)) {
      continue;
    }
    const kept = await readFile(join(root, file.path), 'utf8');
    if (!SIGN_IN_URL.test(kept)) {
      stale.push(file.path);
    }
  }
  return stale;
}
