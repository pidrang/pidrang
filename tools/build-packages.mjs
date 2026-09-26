import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { packages, root, run } from './shared.mjs';

run('pnpm', [
  'exec',
  'nx',
  'run-many',
  '-t',
  'build',
  '-p',
  packages.map((pkg) => pkg.project).join(','),
]);

for (const pkg of packages) {
  copyFileSync(resolve(root, 'LICENSE'), resolve(root, pkg.dist, 'LICENSE'));
}
