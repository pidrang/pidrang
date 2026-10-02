import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { root, run } from '../shared.mjs';
import { withVersionedPackages } from '../versioned-packages.mjs';
import { MANIFEST, describeTarballs } from './identities.mjs';
import { gateDirectory } from './paths.mjs';

function capture(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8' }).trim();
}

const commit = capture('git', ['rev-parse', 'HEAD']);
const { values } = parseArgs({
  options: {
    version: { type: 'string', default: `0.0.0-gate.${commit.slice(0, 12)}` },
  },
});

const tarballs = join(gateDirectory, 'tarballs');
rmSync(gateDirectory, { recursive: true, force: true });
mkdirSync(tarballs, { recursive: true });

const env = { ...process.env, PIDRANG_TARBALLS: tarballs };
withVersionedPackages(values.version, () => {
  run('node', ['tools/pack-packages.mjs'], { env });
  run('node', ['tools/check-tarballs.mjs'], { env });
});
run('node', ['tools/check-install.mjs'], { env });

const manifest = {
  version: values.version,
  source: {
    commit,
    clean: capture('git', ['status', '--porcelain']) === '',
  },
  tools: {
    node: process.version,
    npm: capture('npm', ['--version']),
    pnpm: capture('pnpm', ['--version']),
  },
  tarballs: describeTarballs(tarballs),
  consumers: {},
  gate: { mode: null, passed: false },
};
writeFileSync(
  join(gateDirectory, MANIFEST),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `Packed ${manifest.tarballs.length} tarball(s) at ${values.version} into ${tarballs}.`,
);
