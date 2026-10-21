import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export type TypeScriptApi = typeof import('typescript');

export type LayoutUi = 'material' | 'tailwind';

export interface AppTooling {
  typescript: TypeScriptApi | null;
  welcomeTemplate: string | null;
  layoutUi: LayoutUi;
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

function isCompilerApi(value: unknown): value is TypeScriptApi {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['isVariableStatement'] ===
      'function'
  );
}

function tryLoad(attempt: () => unknown): TypeScriptApi | null {
  try {
    const loaded = attempt();
    return isCompilerApi(loaded) ? loaded : null;
  } catch {
    return null;
  }
}

function loadTypeScript(root: string): TypeScriptApi | null {
  const path = resolveFrom(root, 'typescript');
  return path === null
    ? null
    : tryLoad(() => createRequire(join(root, 'package.json'))(path));
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

function declares(manifest: unknown, name: string): boolean {
  if (typeof manifest !== 'object' || manifest === null) {
    return false;
  }
  return ['dependencies', 'devDependencies'].some((key) => {
    const entries = (manifest as Record<string, unknown>)[key];
    return (
      typeof entries === 'object' &&
      entries !== null &&
      name in (entries as Record<string, unknown>)
    );
  });
}

export function layoutUiOf(manifest: string): LayoutUi {
  try {
    return declares(JSON.parse(manifest), '@pidrang/tailwind')
      ? 'tailwind'
      : 'material';
  } catch {
    return 'material';
  }
}

async function detectLayoutUi(root: string): Promise<LayoutUi> {
  try {
    if (
      layoutUiOf(await readFile(join(root, 'package.json'), 'utf8')) ===
      'tailwind'
    ) {
      return 'tailwind';
    }
  } catch {
    return 'material';
  }
  try {
    const installed: unknown = JSON.parse(
      await readFile(
        join(root, 'node_modules/@pidrang/tailwind/package.json'),
        'utf8',
      ),
    );
    const name =
      typeof installed === 'object' && installed !== null
        ? (installed as Record<string, unknown>)['name']
        : undefined;
    return name === '@pidrang/tailwind' ? 'tailwind' : 'material';
  } catch {
    return 'material';
  }
}

export async function loadAppTooling(root: string): Promise<AppTooling> {
  return {
    typescript: loadTypeScript(root),
    layoutUi: await detectLayoutUi(root),
    welcomeTemplate: await loadWelcomeTemplate(root),
  };
}
