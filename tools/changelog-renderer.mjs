import { execFileSync } from 'node:child_process';

import nxChangelogRenderer from 'nx/release/changelog-renderer';

import { packages, root } from './shared.mjs';

const DefaultChangelogRenderer = nxChangelogRenderer.default;

export const PUBLISHED_SOURCES = packages.map((pkg) => pkg.source);

export function touchesPublishedPackage(files, sources = PUBLISHED_SOURCES) {
  return files.some((file) =>
    sources.some((source) => file.startsWith(`${source}/`)),
  );
}

export function commitFiles(hash) {
  return execFileSync('git', ['show', '--name-only', '--format=', hash], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
}

export default class PublishedPackagesChangelogRenderer extends DefaultChangelogRenderer {
  filterChanges(changes, project) {
    return super
      .filterChanges(changes, project)
      .filter(
        (change) =>
          !change.shortHash ||
          touchesPublishedPackage(this.commitFiles(change.shortHash)),
      );
  }

  commitFiles(hash) {
    return commitFiles(hash);
  }
}
