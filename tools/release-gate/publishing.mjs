import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function distTag(version) {
  return version.includes('-') ? 'next' : 'latest';
}

export function publishOrder(tarballs, names) {
  return names.map((name) => {
    const entry = tarballs.find((tarball) => tarball.name === name);
    if (!entry) {
      throw new Error(`${name}: no tested tarball to publish`);
    }
    return entry;
  });
}

export function integrity(path) {
  return `sha512-${createHash('sha512').update(readFileSync(path)).digest('base64')}`;
}

export function publishAction(published, local) {
  if (published === null) {
    return 'publish';
  }
  return published === local ? 'skip' : 'conflict';
}
