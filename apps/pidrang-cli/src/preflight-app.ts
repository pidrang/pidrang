import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';

export interface AppLayout {
  project: string;
  projectName: string;
  sourceRoot: string;
  appDirectory: string;
  routesFile: string;
  configFile: string;
  takenRoutes: string[];
  bindsComponentInputs: boolean;
  signInPath: string;
  signInRoute: boolean;
}

export class UnsupportedAppError extends Error {
  constructor(readonly problems: string[]) {
    super(
      `This folder is not an app pidrang init can set up: ${problems.join('; ')}.`,
    );
    this.name = 'UnsupportedAppError';
  }
}

const SUPPORTED_ANGULAR = 'Angular 22.1 or a later 22.x';
const ROUTE_PATH = /\bpath\s*:\s*(['"`])((?:(?!\1).)*)\1/g;
const SIGN_IN_PAGE = 'sign-in';

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function readJson(path: string): Promise<unknown> {
  const text = await readText(path);
  if (text === null) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function chooseProject(
  workspace: Record<string, unknown>,
  requested: string | undefined,
): [string, Record<string, unknown>] {
  const projects = isObject(workspace['projects']) ? workspace['projects'] : {};
  const applications = Object.entries(projects).filter(
    (entry): entry is [string, Record<string, unknown>] =>
      isObject(entry[1]) && entry[1]['projectType'] === 'application',
  );
  if (requested !== undefined) {
    const match = applications.find(([name]) => name === requested);
    if (!match) {
      throw new UnsupportedAppError([
        `angular.json has no application named ${JSON.stringify(requested)}${applications.length > 0 ? ` (applications: ${applications.map(([name]) => name).join(', ')})` : ''}`,
      ]);
    }
    return match;
  }
  if (applications.length === 0) {
    throw new UnsupportedAppError(['angular.json declares no application']);
  }
  if (applications.length > 1) {
    throw new UnsupportedAppError([
      `angular.json declares several applications (${applications.map(([name]) => name).join(', ')}): choose one with --project <name>`,
    ]);
  }
  return applications[0];
}

export function displayName(name: string): string {
  const words = name.split(/[-_]+/).filter((word) => word !== '');
  return words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(' ');
}

function sourceRootOf(project: Record<string, unknown>): string | null {
  const root = typeof project['root'] === 'string' ? project['root'] : '';
  const sourceRoot =
    typeof project['sourceRoot'] === 'string'
      ? project['sourceRoot']
      : posix.join(root, 'src');
  const normalized = posix.normalize(sourceRoot.replace(/\\/g, '/'));
  if (
    normalized.startsWith('/') ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    return null;
  }
  return normalized === '.' ? '' : normalized.replace(/\/$/, '');
}

function supportsAngular(version: string): boolean {
  const match = /(\d+)\.(\d+)/.exec(version);
  return match !== null && Number(match[1]) === 22 && Number(match[2]) >= 1;
}

async function angularVersionProblem(root: string): Promise<string | null> {
  const installed = await readJson(
    join(root, 'node_modules/@angular/core/package.json'),
  );
  if (isObject(installed) && typeof installed['version'] === 'string') {
    return supportsAngular(installed['version'])
      ? null
      : `the installed @angular/core is ${installed['version']}, pidrang needs ${SUPPORTED_ANGULAR}`;
  }
  const manifest = await readJson(join(root, 'package.json'));
  if (!isObject(manifest)) {
    return 'there is no readable package.json next to angular.json';
  }
  const declared = [manifest['dependencies'], manifest['devDependencies']]
    .filter(isObject)
    .map((dependencies) => dependencies['@angular/core'])
    .find((range): range is string => typeof range === 'string');
  if (declared === undefined) {
    return 'package.json does not depend on @angular/core';
  }
  return supportsAngular(declared)
    ? null
    : `package.json asks for @angular/core ${declared}, pidrang needs ${SUPPORTED_ANGULAR}`;
}

export function findTakenRoutes(routesSource: string): string[] {
  const routes = [...routesSource.matchAll(ROUTE_PATH)]
    .map((match) => match[2])
    .filter((path) => !path.includes('${'))
    .map((path) => path.split('/')[0])
    .filter(
      (segment) =>
        segment !== '' && segment !== '**' && !segment.startsWith(':'),
    );
  return [...new Set(routes)];
}

function declaresSignInRoute(routesSource: string): boolean {
  return findTakenRoutes(routesSource).includes(SIGN_IN_PAGE);
}

export async function preflightApp(
  root: string,
  requestedProject?: string,
): Promise<AppLayout> {
  const workspace = await readJson(join(root, 'angular.json'));
  if (workspace === undefined) {
    throw new UnsupportedAppError([
      'there is no angular.json here: run pidrang init from the root of your Angular workspace',
    ]);
  }
  if (!isObject(workspace)) {
    throw new UnsupportedAppError(['angular.json is not valid JSON']);
  }
  const [project, definition] = chooseProject(workspace, requestedProject);
  const sourceRoot = sourceRootOf(definition);
  if (sourceRoot === null) {
    throw new UnsupportedAppError([
      `the sourceRoot of ${JSON.stringify(project)} points outside the workspace`,
    ]);
  }
  const appDirectory = posix.join(sourceRoot, 'app');
  const routesFile = posix.join(appDirectory, 'app.routes.ts');
  const configFile = posix.join(appDirectory, 'app.config.ts');

  const problems: string[] = [];
  const versionProblem = await angularVersionProblem(root);
  if (versionProblem) {
    problems.push(versionProblem);
  }
  const config = await readText(join(root, configFile));
  if (config === null) {
    problems.push(
      `${configFile} is missing: pidrang supports a standalone app laid out like ng new creates it`,
    );
  }
  const routes = await readText(join(root, routesFile));
  if (routes === null) {
    problems.push(
      `${routesFile} is missing: create the app with routing, or add that file with export const routes: Routes = []`,
    );
  }
  if (problems.length > 0) {
    throw new UnsupportedAppError(problems);
  }

  return {
    project,
    projectName: displayName(project),
    sourceRoot,
    appDirectory,
    routesFile,
    configFile,
    takenRoutes: findTakenRoutes(routes ?? ''),
    bindsComponentInputs: (config ?? '').includes('withComponentInputBinding'),
    signInPath: `/${SIGN_IN_PAGE}`,
    signInRoute: declaresSignInRoute(routes ?? ''),
  };
}
