import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { packages, root, run, tarballDirectory } from './shared.mjs';

const CHECK_VERSION = '0.0.0-ci.0';

const restorable = [
  'nx.json',
  'pnpm-lock.yaml',
  ...packages.map((pkg) => `${pkg.source}/package.json`),
];

const snapshot = new Map(
  restorable.map((path) => [path, readFileSync(resolve(root, path), 'utf8')]),
);

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

function restore() {
  for (const [path, content] of snapshot) {
    writeFileSync(resolve(root, path), content);
  }
  rmSync(resolve(root, 'dist'), { recursive: true, force: true });
  rmSync(tarballDirectory, { recursive: true, force: true });
}

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
    CHECK_VERSION,
    '--first-release',
  ]);
  run('node', ['tools/pack-packages.mjs']);
  run('node', ['tools/check-tarballs.mjs']);
  run('node', ['tools/check-install.mjs']);
} finally {
  restore();
}
