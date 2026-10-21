import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { UiLayerPackages } from '@pidrang/cli';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type PackageManagerChoice =
  | { manager: PackageManager }
  | { unsupported: string };

export interface Command {
  command: string;
  args: string[];
}

export type RunCommand = (command: Command) => Promise<boolean>;

export const CORE_PACKAGE = '@pidrang/core';

const PACKAGE_MANAGERS: readonly PackageManager[] = [
  'npm',
  'pnpm',
  'yarn',
  'bun',
];

const LOCKFILES: [string, PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
];

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  try {
    return asObject(JSON.parse(await readFile(path, 'utf8')));
  } catch {
    return {};
  }
}

function choiceFromName(name: string): PackageManagerChoice {
  const manager = PACKAGE_MANAGERS.find((known) => known === name);
  return manager === undefined ? { unsupported: name } : { manager };
}

async function declaredManager(root: string): Promise<string | null> {
  const workspace = await readJsonObject(join(root, 'angular.json'));
  const configured = asObject(workspace['cli'])['packageManager'];
  if (typeof configured === 'string' && configured !== '') {
    return configured;
  }
  const manifest = await readJsonObject(join(root, 'package.json'));
  const field = manifest['packageManager'];
  if (typeof field === 'string' && field !== '') {
    return field.split('@')[0];
  }
  return null;
}

async function lockfileSearchPath(root: string): Promise<string[]> {
  const directories: string[] = [];
  let directory = root;
  for (;;) {
    directories.push(directory);
    if (await exists(join(directory, '.git'))) {
      return directories;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      return [root];
    }
    directory = parent;
  }
}

async function lockfileManager(root: string): Promise<PackageManager | null> {
  for (const directory of await lockfileSearchPath(root)) {
    for (const [lockfile, manager] of LOCKFILES) {
      if (await exists(join(directory, lockfile))) {
        return manager;
      }
    }
  }
  return null;
}

export async function detectPackageManager(
  root: string,
): Promise<PackageManagerChoice> {
  const declared = await declaredManager(root);
  if (declared !== null) {
    return choiceFromName(declared);
  }
  return { manager: (await lockfileManager(root)) ?? 'npm' };
}

export function requiredPackages(
  setupPackages: string[],
  uiLayer: UiLayerPackages,
): string[] {
  return [...new Set([CORE_PACKAGE, ...setupPackages, ...uiLayer.install])];
}

function isPidrangPackage(name: string): boolean {
  return name.startsWith('@pidrang/');
}

async function isPresent(
  root: string,
  declared: Record<string, unknown>,
  name: string,
  version: string,
): Promise<boolean> {
  if (!(name in declared)) {
    return false;
  }
  const installed = await readJsonObject(
    join(root, 'node_modules', name, 'package.json'),
  );
  if (typeof installed['version'] !== 'string') {
    return false;
  }
  return !isPidrangPackage(name) || installed['version'] === version;
}

export async function missingPackages(
  root: string,
  names: string[],
  version: string,
): Promise<string[]> {
  const manifest = await readJsonObject(join(root, 'package.json'));
  const declared = {
    ...asObject(manifest['devDependencies']),
    ...asObject(manifest['dependencies']),
  };
  const present = await Promise.all(
    names.map((name) => isPresent(root, declared, name, version)),
  );
  return names.filter((_, index) => !present[index]);
}

export function pinPackages(names: string[], version: string): string[] {
  return names.map((name) =>
    isPidrangPackage(name) ? `${name}@${version}` : name,
  );
}

function installCommand(manager: PackageManager, packages: string[]): Command {
  return manager === 'npm'
    ? { command: 'npm', args: ['install', ...packages] }
    : { command: manager, args: ['add', ...packages] };
}

function ngAddCommand(manager: PackageManager, name: string): Command {
  const ngAdd = ['ng', 'add', name];
  switch (manager) {
    case 'npm':
      return { command: 'npx', args: ngAdd };
    case 'pnpm':
      return { command: 'pnpm', args: ['exec', ...ngAdd] };
    case 'yarn':
      return { command: 'yarn', args: ngAdd };
    case 'bun':
      return { command: 'bunx', args: ngAdd };
  }
}

export function installCommands(
  manager: PackageManager,
  packages: string[],
  ngAdd: string[],
): Command[] {
  return [
    ...(packages.length > 0 ? [installCommand(manager, packages)] : []),
    ...ngAdd.map((name) => ngAddCommand(manager, name)),
  ];
}

export function formatCommand(command: Command): string {
  return [command.command, ...command.args].join(' ');
}

export function spawnCommand(cwd: string): RunCommand {
  return (command) =>
    new Promise((resolve) => {
      const child = spawn(command.command, command.args, {
        cwd,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    });
}
