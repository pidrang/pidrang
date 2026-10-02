import { existsSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

export function spaFile(directory, pathname) {
  const root = resolve(directory);
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { status: 400 };
  }
  const requested = resolve(root, `.${decoded}`);
  const inside = relative(root, requested);
  if (inside.startsWith('..') || isAbsolute(inside)) {
    return { status: 403 };
  }
  const file =
    inside !== '' && existsSync(requested) && statSync(requested).isFile()
      ? requested
      : join(root, 'index.html');
  return { status: 200, file };
}
