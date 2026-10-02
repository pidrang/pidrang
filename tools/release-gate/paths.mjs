import { resolve } from 'node:path';

import { root } from '../shared.mjs';

export const gateDirectory = resolve(
  root,
  process.env['PIDRANG_RELEASE_GATE'] ?? 'tmp/release-gate',
);
