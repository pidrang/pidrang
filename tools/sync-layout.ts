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
const CORE_IMPORT = /^import \{[^}]*\} from '@angular\/core';$/m;
const SIGN_IN_TOKEN_IMPORT = "import { InjectionToken } from '@angular/core';";
const SIGN_IN_URL_IMPORT = "import { UrlTree } from '@angular/router';";
const SIGN_IN_PATH_IMPORT_SOURCE = "export * from './sign-in-path';";
const SIGN_IN_PATH_MODULE = "import { SIGN_IN_PATH } from './sign-in-path';";
const SIGN_IN_PATH_IMPORT = "import { SIGN_IN_PATH } from '../pidrang/index';";
const LAYOUT_DOC_COMMENT =
  "/** @type {import('@angular/router').UrlTree | null} */";
const SIGN_IN_URL = `function injectSignInUrl(): UrlTree | null {
  return inject(SIGN_IN_PATH);
}
`;

function withCoreInject(imports: string): string {
  const core = imports.match(CORE_IMPORT)?.[0];
  if (core === undefined) {
    throw new Error('The demo layout does not import @angular/core');
  }
  if (/(^|[\s,{])inject([\s,}]|$)/.test(core)) {
    return imports;
  }
  return imports.replace(CORE_IMPORT, () =>
    core.replace('Component,', 'Component, inject,'),
  );
}

function withSharedImports(imports: string, modules: string[]): string[] {
  if (
    !generatePagesBundle().some((file) =>
      file.content.includes(SIGN_IN_PATH_IMPORT_SOURCE),
    )
  ) {
    throw new Error('The pages bundle exports no sign-in path module');
  }
  const lines = imports.split('\n');
  const index = lines.indexOf(SHARED_IMPORT);
  if (index < 0) {
    throw new Error('The demo layout does not import @pidrang/demo-shared');
  }
  lines.splice(
    index,
    1,
    LAYOUT_DOC_COMMENT,
    '',
    SIGN_IN_TOKEN_IMPORT,
    SIGN_IN_URL_IMPORT,
  );
  return [
    lines.filter((line) => !modules.includes(line)).join('\n'),
    ...modules,
  ];
}

function materialModules(imports: string): string[] {
  return imports
    .split('\n')
    .filter((line) => line.includes(" from '@angular/material/"));
}

const demoLayout = (app: string): string =>
  join(root, `apps/${app}/src/app/layout/app-layout.ts`);

function demoLayoutParts(
  buildLayoutModule: BuildLayoutModule,
  app: string,
): string[] {
  return buildLayoutModule(readFileSync(demoLayout(app), 'utf8'), (imports) =>
    withSharedImports(withCoreInject(imports), materialModules(imports)),
  );
}

export function materialLayout(buildLayoutModule: BuildLayoutModule): string[] {
  return demoLayoutParts(buildLayoutModule, 'demo-material');
}

export function tailwindLayout(buildLayoutModule: BuildLayoutModule): string[] {
  return demoLayoutParts(buildLayoutModule, 'demo-tailwind');
}

function generatedLayout(parts: string[]): string {
  const [imports, component] = parts;
  const header = [
    imports.replace(LAYOUT_DOC_COMMENT, SIGN_IN_PATH_IMPORT),
    '',
    SIGN_IN_URL,
    ...parts.slice(2),
  ]
    .filter((group) => group.trim() !== '')
    .join('\n\n');
  return `${header}\n\n${component}`;
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
