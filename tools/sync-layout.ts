import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

import { generatePagesBundle } from '../libs/cli/src/lib/generate-pages-bundle';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'libs/cli/src/lib/generated-layout.ts');

export type BuildLayoutModule = (
  source: string,
  replaceImports: (imports: string) => string[],
) => string[];

const SHARED_IMPORT = "import { injectSignInUrl } from '@pidrang/demo-shared';";
const PAGE_HELPERS_IMPORT =
  "import { injectSignInUrl } from '../pidrang/index';";
const SIGN_IN_URL_EXPORT = "export * from './sign-in-url';";

function withPageHelpers(imports: string): string[] {
  if (
    !generatePagesBundle().some(
      (file) =>
        file.path === 'src/app/pidrang/index.ts' &&
        file.content.includes(SIGN_IN_URL_EXPORT),
    )
  ) {
    throw new Error('The page helpers export no injectSignInUrl');
  }
  if (!imports.split('\n').includes(SHARED_IMPORT)) {
    throw new Error('The demo layout does not import @pidrang/demo-shared');
  }
  return [imports.replace(SHARED_IMPORT, () => PAGE_HELPERS_IMPORT)];
}

const demoLayout = (app: string): string =>
  join(root, `apps/${app}/src/app/layout/app-layout.ts`);

function demoLayoutParts(
  buildLayoutModule: BuildLayoutModule,
  app: string,
): string[] {
  return buildLayoutModule(
    readFileSync(demoLayout(app), 'utf8'),
    withPageHelpers,
  );
}

export function materialLayout(buildLayoutModule: BuildLayoutModule): string[] {
  return demoLayoutParts(buildLayoutModule, 'demo-material');
}

export function tailwindLayout(buildLayoutModule: BuildLayoutModule): string[] {
  return demoLayoutParts(buildLayoutModule, 'demo-tailwind');
}

function generatedLayout(parts: string[]): string {
  return parts.join('\n');
}

async function render(): Promise<string> {
  const { layoutParts } = await import(
    '../libs/cli/src/lib/build-layout-module'
  );
  return `export const MATERIAL_LAYOUT_MODULE = ${JSON.stringify(
    generatedLayout(materialLayout(layoutParts)),
  )};
export const TAILWIND_LAYOUT_MODULE = ${JSON.stringify(
    generatedLayout(tailwindLayout(layoutParts)),
  )};
`;
}

async function main(): Promise<void> {
  const rendered = await format(await render(), {
    ...(await resolveConfig(target)),
    filepath: target,
  });
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      current = '';
    }
    if (current !== rendered) {
      console.error(
        'libs/cli/src/lib/generated-layout.ts is out of date: run pnpm run sync:layout',
      );
      process.exitCode = 1;
      return;
    }
    console.log('generated layout is up to date');
    return;
  }
  writeFileSync(target, rendered);
  console.log('wrote libs/cli/src/lib/generated-layout.ts');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
