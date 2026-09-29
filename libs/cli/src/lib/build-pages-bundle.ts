import { posix } from 'node:path';

import { GeneratedFile } from './generated-file';
import { PAGES_BUNDLE_SOURCES } from './pages-bundle-sources';

const SHARED_IMPORT = /from '@pidrang\/demo-shared'/g;
const SHARED_DIR = 'src/app/pidrang';

export function buildPagesBundle(
  readSource: (path: string) => string,
): GeneratedFile[] {
  const files = PAGES_BUNDLE_SOURCES.map(({ target, source }) => ({
    path: target,
    content: readSource(source).replace(
      SHARED_IMPORT,
      `from '${posix.relative(posix.dirname(target), `${SHARED_DIR}/index`)}'`,
    ),
  }));
  const barrel = files
    .filter((file) => posix.dirname(file.path) === SHARED_DIR)
    .map((file) => `export * from './${posix.basename(file.path, '.ts')}';`)
    .join('\n');
  return [...files, { path: `${SHARED_DIR}/index.ts`, content: `${barrel}\n` }];
}
