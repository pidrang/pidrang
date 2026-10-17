import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { packages, root, run } from '../shared.mjs';
import { MANIFEST } from './identities.mjs';
import {
  distTag,
  integrity,
  publishAction,
  publishOrder,
} from './publishing.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    version: { type: 'string' },
    commit: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

function fail(message) {
  console.error(`Publish: ${message}`);
  process.exit(1);
}

function publishedIntegrity(name, version) {
  try {
    const output = execFileSync(
      'npm',
      ['view', `${name}@${version}`, 'dist.integrity'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    return output === '' ? null : output;
  } catch (error) {
    if (String(error.stderr).includes('E404')) {
      return null;
    }
    throw error;
  }
}

if (!values.version || !values.commit) {
  fail('--version and --commit are required');
}

const directory = resolve(positionals[0] ?? 'tmp/release-gate');
try {
  run('node', [
    'tools/release-gate/verify-identities.mjs',
    directory,
    '--version',
    values.version,
    '--commit',
    values.commit,
  ]);
} catch {
  fail('nothing was published');
}

const manifest = JSON.parse(readFileSync(join(directory, MANIFEST), 'utf8'));
const tag = distTag(manifest.version);
const dryRun = values['dry-run'];
let published = 0;

for (const entry of publishOrder(
  manifest.tarballs,
  packages.map((pkg) => pkg.name),
)) {
  const file = join(directory, 'tarballs', entry.file);
  const action = publishAction(
    publishedIntegrity(entry.name, entry.version),
    integrity(file),
  );
  if (action === 'conflict') {
    fail(
      `${entry.name}@${entry.version} is already on npm with other content: publish a new version`,
    );
  }
  if (action === 'skip') {
    console.log(
      `${entry.name}@${entry.version} is already on npm with the same content.`,
    );
    continue;
  }
  run('npm', [
    'publish',
    file,
    '--access',
    'public',
    '--tag',
    tag,
    ...(dryRun ? ['--dry-run'] : ['--provenance']),
  ]);
  published += 1;
}

console.log(
  `${dryRun ? 'Dry run: would publish' : 'Published'} ${published} of ${manifest.tarballs.length} package(s) at ${manifest.version} with the ${tag} tag.`,
);
