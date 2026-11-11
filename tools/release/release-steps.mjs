import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function releaseBranch(version) {
  return `release/v${version}`;
}

export function releaseTag(version) {
  return `v${version}`;
}

export function releaseSubject(version) {
  return `chore(release): v${version}`;
}

export function isPrerelease(version) {
  return version.includes('-');
}

export function compareUrl(repository, version) {
  const title = encodeURIComponent(releaseSubject(version));
  return `https://github.com/${repository}/compare/main...${releaseBranch(version)}?quick_pull=1&title=${title}`;
}

export function versionProblems(root, packages, version) {
  return packages.flatMap((pkg) => {
    const manifest = JSON.parse(
      readFileSync(join(root, pkg.source, 'package.json'), 'utf8'),
    );
    return manifest.version === version
      ? []
      : [`${pkg.name} is at ${manifest.version}, not ${version}`];
  });
}

export function changelogSection(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex(
    (line) => line === `## ${version}` || line.startsWith(`## ${version} `),
  );
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no section for ${version}`);
  }
  const section = lines.slice(start);
  const end = section.findIndex(
    (line, index) => index > 0 && line.startsWith('## '),
  );
  return (end === -1 ? section : section.slice(0, end)).join('\n').trim();
}

export function githubReleaseAction(existing, version) {
  if (existing === null) {
    return 'create';
  }
  const tag = releaseTag(version);
  if (existing.tagName !== tag) {
    throw new Error(
      `the GitHub release found is for ${existing.tagName}, not ${tag}`,
    );
  }
  if (existing.isDraft) {
    throw new Error(
      `the ${tag} GitHub release is a draft: publish or delete it by hand`,
    );
  }
  if (existing.isPrerelease !== isPrerelease(version)) {
    throw new Error(
      `the ${tag} GitHub release is ${existing.isPrerelease ? '' : 'not '}marked as a prerelease`,
    );
  }
  return 'exists';
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function succeeds(cwd, args) {
  try {
    git(cwd, args);
    return true;
  } catch {
    return false;
  }
}

function localTagCommit(cwd, tag) {
  return succeeds(cwd, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])
    ? git(cwd, ['rev-parse', `refs/tags/${tag}^{commit}`])
    : null;
}

function remoteTagCommit(cwd, remote, tag) {
  if (git(cwd, ['ls-remote', '--tags', remote, `refs/tags/${tag}`]) === '') {
    return null;
  }
  const ref = `refs/release-check/${tag}`;
  git(cwd, ['fetch', '--no-tags', remote, `+refs/tags/${tag}:${ref}`]);
  return git(cwd, ['rev-parse', `${ref}^{commit}`]);
}

export function pushReleaseBranch({
  cwd,
  version,
  remote = 'origin',
  dryRun = false,
  log = console.log,
}) {
  const branch = releaseBranch(version);
  if (dryRun) {
    log(`Dry run: would push the release commit to ${branch}, never to main.`);
    return 'dry-run';
  }
  const subject = git(cwd, ['log', '-1', '--format=%s']);
  if (subject !== releaseSubject(version)) {
    throw new Error(`HEAD is "${subject}", not "${releaseSubject(version)}"`);
  }
  const line = git(cwd, [
    'ls-remote',
    '--heads',
    remote,
    `refs/heads/${branch}`,
  ]);
  const tip = line === '' ? null : line.split(/\s+/)[0];
  const lease =
    tip === null ? [] : [`--force-with-lease=refs/heads/${branch}:${tip}`];
  git(cwd, ['push', ...lease, remote, `HEAD:refs/heads/${branch}`]);
  log(`Pushed the release commit to ${branch}.`);
  return tip === null ? 'created' : 'replaced';
}

export function tagRelease({
  cwd,
  version,
  remote = 'origin',
  dryRun = false,
  log = console.log,
}) {
  const tag = releaseTag(version);
  git(cwd, [
    'fetch',
    '--no-tags',
    remote,
    `+refs/heads/main:refs/remotes/${remote}/main`,
  ]);
  const head = git(cwd, ['rev-parse', 'HEAD']);
  if (
    !succeeds(cwd, [
      'merge-base',
      '--is-ancestor',
      head,
      `refs/remotes/${remote}/main`,
    ])
  ) {
    throw new Error(
      `${head} is not on ${remote}/main: merge the release pull request, then run the publish step on main`,
    );
  }
  const pushed = remoteTagCommit(cwd, remote, tag);
  if (pushed !== null) {
    if (pushed !== head) {
      throw new Error(`${tag} already points to ${pushed}, not to ${head}`);
    }
    log(`${tag} is already on ${remote} at ${head}.`);
    return 'exists';
  }
  if (dryRun) {
    log(
      `Dry run: would tag ${head} as ${tag} and push only that tag to ${remote}.`,
    );
    return 'dry-run';
  }
  const local = localTagCommit(cwd, tag);
  if (local === null) {
    git(cwd, ['tag', '-a', tag, '-m', tag]);
  } else if (local !== head) {
    throw new Error(`the local ${tag} points to ${local}, not to ${head}`);
  }
  git(cwd, ['push', remote, `refs/tags/${tag}`]);
  log(`Pushed ${tag} at ${head} to ${remote}.`);
  return 'created';
}
