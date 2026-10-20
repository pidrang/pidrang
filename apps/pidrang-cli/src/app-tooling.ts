import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export type TypeScriptApi = typeof import('typescript');

export interface AppTooling {
  typescript: TypeScriptApi | null;
  welcomeTemplate: string | null;
}

const WELCOME_TEMPLATE =
  'application/files/common-files/src/app/app__suffix__.html.template';

function resolveFrom(directory: string, request: string): string | null {
  try {
    return createRequire(join(directory, 'package.json')).resolve(request);
  } catch {
    return null;
  }
}

function loadTypeScript(root: string): TypeScriptApi | null {
  const path = resolveFrom(root, 'typescript');
  if (path === null) {
    return null;
  }
  try {
    return createRequire(join(root, 'package.json'))(path) as TypeScriptApi;
  } catch {
    return null;
  }
}

function schematicsManifest(root: string): string | null {
  const direct = resolveFrom(root, '@schematics/angular/package.json');
  if (direct !== null) {
    return direct;
  }
  const cli = resolveFrom(root, '@angular/cli/package.json');
  return cli === null
    ? null
    : resolveFrom(dirname(cli), '@schematics/angular/package.json');
}

export function renderWelcomeTemplate(template: string): string {
  return template.replace(/<%[\s\S]*?%>/g, '');
}

async function loadWelcomeTemplate(root: string): Promise<string | null> {
  const manifest = schematicsManifest(root);
  if (manifest === null) {
    return null;
  }
  try {
    return renderWelcomeTemplate(
      await readFile(join(dirname(manifest), WELCOME_TEMPLATE), 'utf8'),
    );
  } catch {
    return null;
  }
}

export async function loadAppTooling(root: string): Promise<AppTooling> {
  return {
    typescript: loadTypeScript(root),
    welcomeTemplate: await loadWelcomeTemplate(root),
  };
}
