import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  changelogSection,
  compareUrl,
  githubReleaseAction,
  pushReleaseBranch,
  releaseBranch,
  releaseSubject,
  releaseTag,
  tagRelease,
  versionProblems,
} from './release-steps.mjs';

const PROTECT_MAIN = `#!/bin/sh
while read old new ref; do
  if [ "$ref" = "refs/heads/main" ]; then
    echo "GH006: Protected branch update failed for refs/heads/main." >&2
    exit 1
  fi
done
`;

let work;
let remote;
let clone;
const quiet = () => undefined;

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(work, 'gitconfig'),
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  }).trim();
}

function commit(subject) {
  writeFileSync(join(clone, 'file.txt'), `${subject}\n`);
  git(clone, 'add', 'file.txt');
  git(clone, 'commit', '-m', subject);
  return git(clone, 'rev-parse', 'HEAD');
}

function remoteRef(ref) {
  const line = git(
    remote,
    'for-each-ref',
    '--format=%(objectname) %(*objectname)',
    ref,
  );
  if (line === '') {
    return null;
  }
  const [object, peeled] = line.split(' ');
  return peeled || object;
}

function protectMain() {
  const hook = join(remote, 'hooks', 'pre-receive');
  writeFileSync(hook, PROTECT_MAIN);
  chmodSync(hook, 0o755);
}

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'pidrang-release-'));
  writeFileSync(join(work, 'gitconfig'), '');
  remote = join(work, 'remote.git');
  clone = join(work, 'clone');
  git(work, 'init', '--bare', '--initial-branch=main', remote);
  git(work, 'init', '--initial-branch=main', clone);
  git(clone, 'config', 'user.name', 'Test');
  git(clone, 'config', 'user.email', 'test@example.com');
  git(clone, 'config', 'commit.gpgSign', 'false');
  git(clone, 'config', 'tag.gpgSign', 'false');
  git(clone, 'remote', 'add', 'origin', remote);
  commit('fix(core): first');
  git(clone, 'push', '-u', 'origin', 'main');
});

afterEach(() => rmSync(work, { recursive: true, force: true }));

test('nx release pushes main and the protected remote refuses the tag with it', () => {
  protectMain();
  const before = remoteRef('refs/heads/main');
  commit('chore(release): v0.1.2');
  git(clone, 'tag', '-a', 'v0.1.2', '-m', 'v0.1.2');

  assert.throws(
    () => git(clone, 'push', '--follow-tags', '--no-verify', '--atomic'),
    (error) => String(error.stderr).includes('GH006'),
  );
  assert.equal(remoteRef('refs/heads/main'), before);
  assert.equal(remoteRef('refs/tags/v0.1.2'), null);
});

test('names the branch, the tag and the release commit after the version', () => {
  assert.equal(releaseBranch('0.1.2'), 'release/v0.1.2');
  assert.equal(releaseTag('0.1.2'), 'v0.1.2');
  assert.equal(releaseSubject('0.2.0-rc.1'), 'chore(release): v0.2.0-rc.1');
  assert.equal(
    compareUrl('pidrang/pidrang', '0.1.2'),
    'https://github.com/pidrang/pidrang/compare/main...release/v0.1.2?quick_pull=1&title=chore(release)%3A%20v0.1.2',
  );
});

test('pushes the release commit to its branch and leaves the protected main alone', () => {
  protectMain();
  const before = remoteRef('refs/heads/main');
  const release = commit('chore(release): v0.1.2');

  assert.equal(
    pushReleaseBranch({ cwd: clone, version: '0.1.2', log: quiet }),
    'created',
  );
  assert.equal(remoteRef('refs/heads/release/v0.1.2'), release);
  assert.equal(remoteRef('refs/heads/main'), before);
  assert.equal(remoteRef('refs/tags/v0.1.2'), null);
});

test('replaces the release branch of an earlier prepare run', () => {
  protectMain();
  commit('chore(release): v0.1.2');
  pushReleaseBranch({ cwd: clone, version: '0.1.2', log: quiet });
  git(clone, 'reset', '--hard', 'HEAD~1');
  const again = commit('chore(release): v0.1.2');

  assert.equal(
    pushReleaseBranch({ cwd: clone, version: '0.1.2', log: quiet }),
    'replaced',
  );
  assert.equal(remoteRef('refs/heads/release/v0.1.2'), again);
});

test('refuses to push a branch when HEAD is not the release commit', () => {
  commit('fix(core): not a release');
  assert.throws(
    () => pushReleaseBranch({ cwd: clone, version: '0.1.2', log: quiet }),
    /not "chore\(release\): v0\.1\.2"/,
  );
  assert.equal(remoteRef('refs/heads/release/v0.1.2'), null);
});

test('pushes nothing on a dry run', () => {
  assert.equal(
    tagRelease({ cwd: clone, version: '0.1.2', dryRun: true, log: quiet }),
    'dry-run',
  );
  assert.equal(remoteRef('refs/tags/v0.1.2'), null);
  assert.equal(git(clone, 'tag', '--list', 'v0.1.2'), '');

  commit('chore(release): v0.1.2');
  assert.equal(
    pushReleaseBranch({
      cwd: clone,
      version: '0.1.2',
      dryRun: true,
      log: quiet,
    }),
    'dry-run',
  );
  assert.equal(remoteRef('refs/heads/release/v0.1.2'), null);
});

test('tags a commit of main and pushes only the tag', () => {
  const merged = commit('chore(release): v0.1.2 (#200)');
  git(clone, 'push', 'origin', 'main');
  protectMain();

  assert.equal(
    tagRelease({ cwd: clone, version: '0.1.2', log: quiet }),
    'created',
  );
  assert.equal(remoteRef('refs/tags/v0.1.2'), merged);
  assert.equal(remoteRef('refs/heads/main'), merged);
  assert.equal(git(clone, 'cat-file', '-t', 'refs/tags/v0.1.2'), 'tag');
});

test('refuses to tag a commit that is not on main', () => {
  protectMain();
  commit('chore(release): v0.1.2');

  assert.throws(
    () => tagRelease({ cwd: clone, version: '0.1.2', log: quiet }),
    /is not on origin\/main/,
  );
  assert.equal(remoteRef('refs/tags/v0.1.2'), null);
  assert.equal(git(clone, 'tag', '--list', 'v0.1.2'), '');
});

test('keeps a tag already pushed on the same commit', () => {
  protectMain();
  tagRelease({ cwd: clone, version: '0.1.2', log: quiet });

  assert.equal(
    tagRelease({ cwd: clone, version: '0.1.2', log: quiet }),
    'exists',
  );
});

test('refuses a tag that already points to another commit', () => {
  const first = git(clone, 'rev-parse', 'HEAD');
  git(clone, 'tag', '-a', 'v0.1.2', '-m', 'v0.1.2');
  git(clone, 'push', 'origin', 'refs/tags/v0.1.2');
  git(clone, 'tag', '-d', 'v0.1.2');
  commit('fix(core): later');
  git(clone, 'push', 'origin', 'main');
  protectMain();

  assert.throws(
    () => tagRelease({ cwd: clone, version: '0.1.2', log: quiet }),
    new RegExp(`v0\\.1\\.2 already points to ${first}`),
  );
  assert.equal(remoteRef('refs/tags/v0.1.2'), first);
});

test('reads the changelog section of a version', () => {
  const changelog = [
    '## 0.2.0-rc.1 (2026-11-12)',
    '',
    '### Fixes',
    '',
    '- **cli:** rc fix',
    '',
    '## 0.1.1 (2026-11-06)',
    '',
    '### Features',
    '',
    '- **core:** feature',
    '',
  ].join('\n');

  assert.equal(
    changelogSection(changelog, '0.2.0-rc.1'),
    '## 0.2.0-rc.1 (2026-11-12)\n\n### Fixes\n\n- **cli:** rc fix',
  );
  assert.equal(
    changelogSection(changelog, '0.1.1'),
    '## 0.1.1 (2026-11-06)\n\n### Features\n\n- **core:** feature',
  );
  assert.throws(
    () => changelogSection(changelog, '0.1'),
    /no section for 0\.1/,
  );
});

test('lists the packages that do not hold the release version', () => {
  const packages = [
    { name: '@pidrang/core', source: 'libs/core' },
    { name: 'pidrang', source: 'apps/pidrang-cli' },
  ];
  for (const [source, version] of [
    ['libs/core', '0.1.2'],
    ['apps/pidrang-cli', '0.1.1'],
  ]) {
    mkdirSync(join(work, source), { recursive: true });
    writeFileSync(
      join(work, source, 'package.json'),
      JSON.stringify({ version }),
    );
  }

  assert.deepEqual(versionProblems(work, packages, '0.1.2'), [
    'pidrang is at 0.1.1, not 0.1.2',
  ]);
});

test('creates a GitHub release only when none matches the tag', () => {
  assert.equal(githubReleaseAction(null, '0.1.2'), 'create');
  assert.equal(
    githubReleaseAction(
      { tagName: 'v0.1.2', isDraft: false, isPrerelease: false },
      '0.1.2',
    ),
    'exists',
  );
  assert.equal(
    githubReleaseAction(
      { tagName: 'v0.2.0-rc.1', isDraft: false, isPrerelease: true },
      '0.2.0-rc.1',
    ),
    'exists',
  );
  assert.throws(
    () =>
      githubReleaseAction(
        { tagName: 'v0.1.1', isDraft: false, isPrerelease: false },
        '0.1.2',
      ),
    /for v0\.1\.1, not v0\.1\.2/,
  );
  assert.throws(
    () =>
      githubReleaseAction(
        { tagName: 'v0.1.2', isDraft: true, isPrerelease: false },
        '0.1.2',
      ),
    /draft/,
  );
  assert.throws(
    () =>
      githubReleaseAction(
        { tagName: 'v0.1.2', isDraft: false, isPrerelease: true },
        '0.1.2',
      ),
    /prerelease/,
  );
});
