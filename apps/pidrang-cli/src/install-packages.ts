import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { UiLayerPackages } from '@pidrang/cli';

export type PackageManager = 'npm' | 'pnpm' | 'yarn';

export interface Command {
  command: string;
  args: string[];
}

export type RunCommand = (command: Command) => Promise<boolean>;

export const CORE_PACKAGE = '@pidrang/core';

const LOCKFILES: [string, PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
];

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

export async function detectPackageManager(
  root: string,
): Promise<PackageManager> {
  for (const [lockfile, manager] of LOCKFILES) {
    if (await exists(join(root, lockfile))) {
      return manager;
    }
  }
  return 'npm';
}

function pinned(name: string, version: string): string {
  return name.startsWith('@pidrang/') ? `${name}@${version}` : name;
}

export function packagesToInstall(
  setupPackages: string[],
  uiLayer: UiLayerPackages,
  version: string,
): string[] {
  const names = [
    ...new Set([CORE_PACKAGE, ...setupPackages, ...uiLayer.install]),
  ];
  return names.map((name) => pinned(name, version));
}

function installCommand(manager: PackageManager, packages: string[]): Command {
  return manager === 'npm'
    ? { command: 'npm', args: ['install', ...packages] }
    : { command: manager, args: ['add', ...packages] };
}

function ngAddCommand(manager: PackageManager, name: string): Command {
  const ngAdd = ['ng', 'add', name];
  if (manager === 'npm') {
    return { command: 'npx', args: ngAdd };
  }
  if (manager === 'pnpm') {
    return { command: 'pnpm', args: ['exec', ...ngAdd] };
  }
  return { command: 'yarn', args: ngAdd };
}

export function installCommands(
  manager: PackageManager,
  packages: string[],
  uiLayer: UiLayerPackages,
): Command[] {
  return [
    installCommand(manager, packages),
    ...uiLayer.ngAdd.map((name) => ngAddCommand(manager, name)),
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
