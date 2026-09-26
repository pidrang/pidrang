import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { packages, root, run, tarballDirectory } from './shared.mjs';

rmSync(tarballDirectory, { recursive: true, force: true });
mkdirSync(tarballDirectory, { recursive: true });

for (const pkg of packages) {
  run('npm', ['pack', '--pack-destination', tarballDirectory, '--silent'], {
    cwd: resolve(root, pkg.dist),
  });
}
