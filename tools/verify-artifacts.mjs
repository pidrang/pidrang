import { rmSync } from 'node:fs';

import { run, tarballDirectory } from './shared.mjs';
import { withVersionedPackages } from './versioned-packages.mjs';

try {
  withVersionedPackages('0.0.0-ci.0', () => {
    run('node', ['tools/pack-packages.mjs']);
    run('node', ['tools/check-tarballs.mjs']);
    run('node', ['tools/check-install.mjs']);
  });
} finally {
  rmSync(tarballDirectory, { recursive: true, force: true });
}
