import { test } from 'node:test';
import assert from 'node:assert/strict';

import PublishedPackagesChangelogRenderer, {
  PUBLISHED_SOURCES,
  touchesPublishedPackage,
} from './changelog-renderer.mjs';

test('publishes the changes of the seven package sources', () => {
  assert.deepEqual(PUBLISHED_SOURCES, [
    'libs/core',
    'libs/supabase',
    'libs/material',
    'libs/tailwind',
    'libs/cli',
    'libs/cli-supabase',
    'apps/pidrang-cli',
  ]);
});

test('keeps a commit only when it touches a published package', () => {
  const cases = [
    [['libs/core/src/lib/resource.ts'], true],
    [['libs/cli-supabase/src/index.ts'], true],
    [['apps/pidrang-cli/src/main.ts'], true],
    [['libs/material/package.json'], true],
    [['apps/demo-material/src/app/app.ts', 'libs/cli/src/index.ts'], true],
    [['nx.json', 'docs/releasing.md', 'libs/tailwind/README.md'], true],
    [['apps/demo-material/src/app/app.ts'], false],
    [['apps/demo-tailwind-e2e/src/app.spec.ts'], false],
    [['libs/demo-shared/src/index.ts'], false],
    [['tools/release-gate/run.mjs'], false],
    [['nx.json', 'package.json', 'pnpm-lock.yaml'], false],
    [['docs/releasing.md', 'README.md'], false],
    [['libs/core-extra/src/index.ts'], false],
    [['libs/cli-tools/src/index.ts'], false],
    [['apps/pidrang-cli-e2e/src/main.ts'], false],
    [['libs/core'], false],
    [[], false],
  ];
  for (const [files, expected] of cases) {
    assert.equal(
      touchesPublishedPackage(files),
      expected,
      JSON.stringify(files),
    );
  }
});

const FILES = {
  aaaaaaa: ['libs/core/src/lib/resource.ts', 'apps/demo/src/app.ts'],
  bbbbbbb: ['apps/demo/src/app.ts'],
  ccccccc: ['tools/release-gate/run.mjs', 'docs/releasing.md'],
  ddddddd: ['apps/demo-tailwind/src/app.ts'],
  eeeeeee: ['libs/material/src/lib/resource-table.ts'],
};

class Renderer extends PublishedPackagesChangelogRenderer {
  commitFiles(hash) {
    return FILES[hash];
  }
}

function change(shortHash, overrides = {}) {
  return {
    type: 'feat',
    scope: '',
    description: `change ${shortHash}`,
    body: '',
    isBreaking: false,
    githubReferences: [],
    authors: [],
    shortHash,
    revertedHashes: [],
    affectedProjects: '*',
    ...overrides,
  };
}

function renderer(changes, project = null) {
  return new Renderer({
    changes,
    changelogEntryVersion: '0.1.0',
    project,
    entryWhenNoChanges: false,
    isVersionPlans: false,
    changelogRenderOptions: { authors: false },
    dependencyBumps: [],
    conventionalCommitsConfig: {
      types: {
        feat: { semverBump: 'minor', changelog: { title: 'Features' } },
        fix: { semverBump: 'patch', changelog: { title: 'Fixes' } },
      },
    },
    remoteReleaseClient: { getRemoteRepoData: () => null },
  });
}

test('drops the commits that touch no published package', () => {
  const kept = renderer(
    ['aaaaaaa', 'bbbbbbb', 'ccccccc', 'eeeeeee'].map((hash) => change(hash)),
  ).changes.map((entry) => entry.shortHash);
  assert.deepEqual(kept, ['aaaaaaa', 'eeeeeee']);
});

test('keeps a change without a commit, such as a version plan entry', () => {
  assert.equal(renderer([change(undefined)]).changes.length, 1);
});

test('still applies the project filter of a project changelog', () => {
  const kept = renderer(
    [
      change('aaaaaaa', { affectedProjects: ['core'] }),
      change('eeeeeee', { affectedProjects: ['material'] }),
      change('bbbbbbb', { affectedProjects: ['demo'] }),
    ],
    'core',
  ).changes.map((entry) => entry.shortHash);
  assert.deepEqual(kept, ['aaaaaaa']);
});

test('lists only the breaking changes of published packages', async () => {
  const markdown = await renderer([
    change('ddddddd', {
      type: 'fix',
      description: 'rename the demo selectors',
      isBreaking: true,
      body: 'BREAKING CHANGE: demo selectors renamed',
    }),
    change('eeeeeee', {
      type: 'fix',
      description: 'rename the table selector',
      isBreaking: true,
      body: 'BREAKING CHANGE: table selector renamed',
    }),
  ]).render();
  assert.match(markdown, /rename the table selector/);
  assert.match(markdown, /table selector renamed/);
  assert.doesNotMatch(markdown, /demo selectors/);
});

test('renders no entry when no change touches a published package', async () => {
  assert.equal(
    await renderer([change('bbbbbbb'), change('ccccccc')]).render(),
    '',
  );
});
