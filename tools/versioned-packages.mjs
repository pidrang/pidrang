import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { packages, root, run } from './shared.mjs';

const restorable = [
  'nx.json',
  'pnpm-lock.yaml',
  ...packages.map((pkg) => `${pkg.source}/package.json`),
];

function releaseCheckConfig(original) {
  const config = JSON.parse(original);
  const release = config.release;
  release.projects = packages.map((pkg) => pkg.project);
  delete release.git;
  release.version = {
    ...release.version,
    git: { stageChanges: false, commit: false, tag: false },
  };
  release.changelog = {
    ...release.changelog,
    git: { commit: false, tag: false, push: false },
    workspaceChangelog: {
      ...release.changelog.workspaceChangelog,
      createRelease: false,
    },
  };
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function withVersionedPackages(version, work) {
  const snapshot = new Map(
    restorable.map((path) => [path, readFileSync(resolve(root, path), 'utf8')]),
  );
  try {
    writeFileSync(
      resolve(root, 'nx.json'),
      releaseCheckConfig(snapshot.get('nx.json')),
    );
    run('pnpm', [
      'exec',
      'nx',
      'release',
      'version',
      version,
      '--first-release',
    ]);
    work();
  } finally {
    for (const [path, content] of snapshot) {
      writeFileSync(resolve(root, path), content);
    }
  }
}
