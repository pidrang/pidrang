import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { packages } from '../shared.mjs';
import {
  MANIFEST,
  compareTarballs,
  describeTarballs,
  gateProblems,
  packageProblems,
} from './identities.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { 'allow-dirty': { type: 'boolean', default: false } },
});
const directory = resolve(positionals[0] ?? 'tmp/release-gate');
const manifestPath = join(directory, MANIFEST);

if (!existsSync(manifestPath)) {
  console.error(`no ${MANIFEST} in ${directory}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const problems = [
  ...gateProblems(manifest, { allowDirty: values['allow-dirty'] }),
  ...packageProblems(
    manifest,
    packages.map((pkg) => pkg.name),
  ),
  ...compareTarballs(
    manifest.tarballs ?? [],
    describeTarballs(join(directory, 'tarballs')),
  ),
];

if (problems.length > 0) {
  console.error('These tarballs cannot be published as tested:');
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(
  `${manifest.tarballs.length} tarball(s) match the release gate manifest (version ${manifest.version}, commit ${manifest.source.commit}).`,
);
