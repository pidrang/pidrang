import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

import { buildPagesBundle } from '../libs/cli/src/lib/build-pages-bundle';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'libs/cli/src/lib/generated-pages.ts');

async function render(): Promise<string> {
  const files = buildPagesBundle((path) =>
    readFileSync(join(root, path), 'utf8'),
  );
  const entries = files
    .map(
      (file) =>
        `  { path: ${JSON.stringify(file.path)}, content: ${JSON.stringify(file.content)} },`,
    )
    .join('\n');
  const source = [
    `import { GeneratedFile } from './generated-file';`,
    ``,
    `export const GENERATED_PAGE_FILES: GeneratedFile[] = [`,
    entries,
    `];`,
    ``,
  ].join('\n');
  const options = await resolveConfig(target);
  return format(source, { ...options, filepath: target });
}

async function main(): Promise<void> {
  const rendered = await render();
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      current = '';
    }
    if (current !== rendered) {
      console.error(
        'libs/cli/src/lib/generated-pages.ts is out of date: run pnpm run sync:pages',
      );
      process.exitCode = 1;
      return;
    }
    console.log('generated pages are up to date');
    return;
  }
  writeFileSync(target, rendered);
  console.log('wrote libs/cli/src/lib/generated-pages.ts');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
