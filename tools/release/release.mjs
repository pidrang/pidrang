import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { packages, root } from '../shared.mjs';
import {
  changelogSection,
  compareUrl,
  githubReleaseAction,
  isPrerelease,
  pushReleaseBranch,
  releaseTag,
  tagRelease,
  versionProblems,
} from './release-steps.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { 'dry-run': { type: 'boolean', default: false } },
});
const [step, version] = positionals;
const dryRun = values['dry-run'];
const repository = process.env.GITHUB_REPOSITORY ?? 'pidrang/pidrang';

function fail(message) {
  console.error(`Release: ${message}`);
  process.exit(1);
}

function summary(text) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  }
}

function existingRelease(tag) {
  try {
    return JSON.parse(
      execFileSync(
        'gh',
        [
          'release',
          'view',
          tag,
          '--repo',
          repository,
          '--json',
          'tagName,isDraft,isPrerelease',
        ],
        { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ),
    );
  } catch (error) {
    if (String(error.stderr).includes('release not found')) {
      return null;
    }
    throw new Error(
      `could not read the ${tag} GitHub release: ${String(error.stderr).trim()}`,
    );
  }
}

function checkVersion() {
  const problems = versionProblems(root, packages, version);
  if (problems.length > 0) {
    fail(
      `${problems.join('; ')}. Merge the release pull request of ${version}, then run the publish step on main.`,
    );
  }
  console.log(`All ${packages.length} packages are at ${version}.`);
}

function branch() {
  pushReleaseBranch({ cwd: root, version, dryRun });
  const message = `Open the release pull request: ${compareUrl(repository, version)}`;
  console.log(message);
  summary(message);
}

function githubRelease() {
  const tag = releaseTag(version);
  const notes = changelogSection(
    readFileSync(join(root, 'CHANGELOG.md'), 'utf8'),
    version,
  );
  if (githubReleaseAction(existingRelease(tag), version) === 'exists') {
    console.log(`The ${tag} GitHub release already exists.`);
    return;
  }
  const file = join(
    mkdtempSync(join(tmpdir(), 'pidrang-release-notes-')),
    'notes.md',
  );
  const args = [
    'release',
    'create',
    tag,
    '--repo',
    repository,
    '--verify-tag',
    '--title',
    tag,
    '--notes-file',
    file,
    ...(isPrerelease(version) ? ['--prerelease'] : []),
  ];
  if (dryRun) {
    console.log(
      `Dry run: would run gh ${args.join(' ')} with these notes:\n\n${notes}`,
    );
    return;
  }
  writeFileSync(file, `${notes}\n`);
  execFileSync('gh', args, { cwd: root, stdio: 'inherit' });
}

const steps = {
  'check-version': checkVersion,
  branch,
  tag: () => tagRelease({ cwd: root, version, dryRun }),
  'github-release': githubRelease,
};

if (!version || !(step in steps)) {
  fail(
    'usage: release.mjs <check-version|branch|tag|github-release> <version> [--dry-run]',
  );
}
try {
  steps[step]();
} catch (error) {
  fail(error.message);
}
