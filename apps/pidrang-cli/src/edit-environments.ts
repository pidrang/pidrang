import { posix } from 'node:path';
import { EnvironmentEntry, GeneratedFile, quote } from '@pidrang/cli';

export const ENVIRONMENTS_DIRECTORY = 'environments';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function environmentFileContent(entries: EnvironmentEntry[]): string {
  return [
    'export const environment = {',
    ...entries.map((entry) => `  ${entry.name}: ${quote(entry.value)},`),
    '};',
    '',
  ].join('\n');
}

export function environmentPaths(sourceRoot: string): {
  default: string;
  development: string;
} {
  const directory = posix.join(sourceRoot, ENVIRONMENTS_DIRECTORY);
  return {
    default: posix.join(directory, 'environment.ts'),
    development: posix.join(directory, 'environment.development.ts'),
  };
}

export function environmentImportPath(
  appDirectory: string,
  sourceRoot: string,
): string {
  const target = posix.join(sourceRoot, ENVIRONMENTS_DIRECTORY, 'environment');
  const relative = posix.relative(appDirectory, target);
  return relative.startsWith('.') ? relative : `./${relative}`;
}

export function environmentFiles(
  sourceRoot: string,
  entries: EnvironmentEntry[],
): GeneratedFile[] {
  const paths = environmentPaths(sourceRoot);
  const content = environmentFileContent(entries);
  return [
    { path: paths.default, content },
    { path: paths.development, content },
  ];
}

export function environmentLines(
  entries: EnvironmentEntry[],
  existing: string,
): string[] {
  const missing = entries.filter(
    (entry) => !new RegExp(`\\b${entry.name}\\b`).test(existing),
  );
  return missing.map(
    (entry) =>
      `  ${entry.name}: ${quote(entry.value)},${entry.hint ? ` // ${entry.hint}` : ''}`,
  );
}

export function addEnvironmentFileReplacements(
  workspaceText: string,
  project: string,
  sourceRoot: string,
): string | null {
  let workspace: unknown;
  try {
    workspace = JSON.parse(workspaceText);
  } catch {
    return null;
  }
  if (!isObject(workspace) || !isObject(workspace['projects'])) {
    return null;
  }
  const projectDefinition = workspace['projects'][project];
  if (!isObject(projectDefinition)) {
    return null;
  }
  const targets =
    projectDefinition['architect'] ?? projectDefinition['targets'];
  if (!isObject(targets) || !isObject(targets['build'])) {
    return null;
  }
  const build = targets['build'];
  const configurations = build['configurations'];
  if (!isObject(configurations)) {
    return null;
  }
  const paths = environmentPaths(sourceRoot);
  let changed = false;
  for (const [name, options] of Object.entries(configurations)) {
    if (name === build['defaultConfiguration'] || !isObject(options)) {
      continue;
    }
    const replacements = Array.isArray(options['fileReplacements'])
      ? options['fileReplacements']
      : [];
    const replaced = replacements.some(
      (entry) => isObject(entry) && entry['replace'] === paths.default,
    );
    if (!replaced) {
      options['fileReplacements'] = [
        ...replacements,
        { replace: paths.default, with: paths.development },
      ];
      changed = true;
    }
  }
  return changed ? `${JSON.stringify(workspace, null, 2)}\n` : null;
}
