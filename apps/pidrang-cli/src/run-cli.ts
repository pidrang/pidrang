import { readFile } from 'node:fs/promises';
import { join, posix, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  AppSetup,
  GeneratedFile,
  InitResult,
  PAGES_UI_LAYER_PACKAGES,
  PlanEnvironment,
  SIGN_IN_PAGE_FILE,
  SIGN_IN_PATH_SNIPPET,
  SchemaProviderDefinition,
  generateLayoutFile,
  generatePagesBundle,
  generateResourceRoutesFile,
  generateResourcesFile,
  generateSignInFile,
  layoutAppHtml,
  parseInitPlan,
  runInitWizard,
  runScriptedInit,
} from '@pidrang/cli';
import { AppLayout, UnsupportedAppError, preflightApp } from './preflight-app';
import {
  WriteConflict,
  WriteInterruptedError,
  WritePlan,
  FileEditPlan,
  applyWritePlan,
  conflictReason,
  planEdits,
  planWrites,
  relocateFiles,
} from './write-plan';
import { AppTooling, loadAppTooling } from './app-tooling';
import { ConfigRequest, FileEdit, editAppConfig } from './edit-app-config';
import {
  declaresEntryRoute,
  editAppRoutes,
  isNewApp,
  quote,
} from './edit-app-routes';
import { editAppHtml } from './edit-app-html';
import { editAppComponent } from './edit-app-component';
import { editAppSpec } from './edit-app-spec';
import { editResources } from './edit-resources';
import { existingSignedInGuards } from './existing-signed-in-guards';
import { entryRedirect } from './entry-redirect';
import {
  addEnvironmentFileReplacements,
  environmentFiles,
  environmentImportPath,
  environmentLines,
  environmentPaths,
} from './edit-environments';
import { formatDiff } from './line-diff';
import { nodeVersionProblem } from './node-version';
import {
  Command,
  RunCommand,
  detectPackageManager,
  formatCommand,
  installCommands,
  missingPackages,
  pinPackages,
  requiredPackages,
} from './install-packages';

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_CANCELLED = 130;

export interface CliContext {
  providers: SchemaProviderDefinition[];
  cwd: string;
  env: PlanEnvironment;
  out: (line: string) => void;
  err: (line: string) => void;
  watchInterrupt: () => { signal: AbortSignal; dispose: () => void };
  interactive: boolean;
  nodeVersion: string;
  version: string;
  confirmInstall: () => Promise<boolean>;
  runCommand: RunCommand;
  tooling?: AppTooling;
}

interface InitOptions {
  planPath: string | undefined;
  project: string | undefined;
  skipInstall: boolean;
}

type InstallOutcome =
  | 'installed'
  | 'present'
  | 'skipped'
  | 'unsupported'
  | 'failed'
  | 'cancelled';

function usage(providers: SchemaProviderDefinition[]): string {
  return [
    'Usage: pidrang init [--plan <file>] [--project <name>] [--skip-install]',
    '       pidrang generate auth [--project <name>]',
    '',
    'init scaffolds Resource definitions and CRUD pages into an Angular app. Run it from the workspace root.',
    'generate auth writes the sign-in page the pages and the layout link to, when the app has none.',
    '',
    'Options:',
    '  --plan <file>     Take the answers from a JSON plan file instead of prompts (init)',
    '  --project <name>  The application to set up, when angular.json has several',
    '  --skip-install    Do not offer to install the packages, print the commands instead (init)',
    '  -h, --help        Show this help',
    '',
    'Plan file:',
    '  {',
    '    "provider": "supabase",',
    '    "connection": { ... },',
    '    "tables": [',
    '      { "table": "products", "actions": ["list", "create", "show", "edit", "delete"], "hiddenFields": ["created_at"] }',
    '    ],',
    '    "layout": "sidebar",',
    '    "signIn": true,',
    '    "readsNeedSignIn": false',
    '  }',
    '  actions lists at least one of list, create, show, edit, delete. hiddenFields is optional.',
    '  layout is "sidebar" to add a header and a side menu of the resources to a new app, or',
    '  "none" to leave the pages bare. It defaults to "none" and an existing app never gets one.',
    '  signIn is true to generate the sign-in page that the pages and the layout link to. It',
    '  defaults to false and init asks for it on a new app.',
    '  readsNeedSignIn is true when the select policy of the tables hides their rows from anonymous',
    '  visitors: a new app then opens on the sign-in page instead of an empty list. It applies to',
    '  every table, defaults to false, and the direct database connection strategy answers per table',
    '  from its row level security, its select policies and its grant to the anonymous role instead.',
    '  Credentials never go in the plan file: they come from environment variables.',
    '',
    ...providers.map((provider) => provider.planHelp),
    '',
    'It writes the resources, pages, helpers and resource routes, and it edits app.config.ts,',
    'app.routes.ts and app.html. When it replaces the welcome page, it also removes the welcome',
    'title test of app.spec.ts. It creates src/environments when the app has none. A file it',
    'writes is never overwritten: one that already exists with other content stops init before',
    'any write. An existing resources.ts is edited instead: a second run appends the tables it does',
    'not list yet and leaves the others as they are. When a file cannot be edited safely, init adds',
    'a "pidrang:" comment that lists the exact change to make.',
    '',
    'Once the files are written, it offers to install the packages the generated code imports that the',
    'app does not have yet, then runs ng add @angular/material when Material is missing. The package',
    'manager comes from angular.json, then package.json, then the closest lockfile up to the git root',
    '(npm when there is none). With --plan or --skip-install it prints the commands instead.',
    '',
    'Exit status: 0 done or nothing to do, 1 invalid input, unsupported Node.js or app, conflicting',
    'file or failed install, 130 cancelled.',
  ].join('\n');
}

const COMMANDS: Record<string, 'init' | 'generate auth' | undefined> = {
  init: 'init',
  'generate auth': 'generate auth',
};

function isPromptExit(error: unknown): boolean {
  return error instanceof Error && error.name === 'ExitPromptError';
}

async function readOptional(
  root: string,
  path: string,
): Promise<string | null> {
  try {
    return await readFile(join(root, path), 'utf8');
  } catch {
    return null;
  }
}

async function readPlanFile(cwd: string, path: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(resolve(cwd, path), 'utf8');
  } catch {
    throw new Error(`Could not read the plan file at "${path}".`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The plan file at "${path}" is not valid JSON.`);
  }
}

function reportConflicts(
  context: CliContext,
  layout: AppLayout,
  plan: WritePlan,
): void {
  context.err(
    'pidrang init stopped before writing anything: these files already exist and cannot be kept as they are:',
  );
  plan.conflicts.forEach((conflict) =>
    context.err(`  ${conflict.path}: ${conflict.reason}`),
  );
  context.err(
    `\npidrang never overwrites a file. If the pages or helpers come from an older pidrang init, delete ${layout.appDirectory}/pages and ${layout.appDirectory}/pidrang together (the pages need the matching helpers) and run it again.`,
  );
}

function editCandidate(
  path: string,
  before: string,
  edit: FileEdit,
): FileEditPlan[] {
  if (edit.kind === 'unchanged') {
    return [];
  }
  return [
    {
      path,
      before,
      after: edit.content,
      manual: edit.kind === 'manual',
      reason: edit.kind === 'manual' ? edit.reason : undefined,
    },
  ];
}

async function collectPlan(
  context: CliContext,
  layout: AppLayout,
  planPath: string | undefined,
  isNewApp: boolean,
  askReadsNeedSignIn: boolean,
): Promise<InitResult> {
  const options = {
    takenRoutes: layout.takenRoutes,
    isNewApp,
    askReadsNeedSignIn,
    reportLeftOutColumns: context.out,
    warn: context.err,
  };
  if (planPath === undefined) {
    return runInitWizard(context.providers, options);
  }
  const plan = parseInitPlan(await readPlanFile(context.cwd, planPath));
  return runScriptedInit(context.providers, plan, context.env, options);
}

interface SignInPlan {
  path: string;
  file: GeneratedFile | null;
  written: boolean;
  reason: string;
}

function signInFile(layout: AppLayout, tooling: AppTooling): GeneratedFile {
  return relocateFiles(
    [generateSignInFile(tooling.layoutUi)],
    layout.appDirectory,
  )[0];
}

async function planSignIn(
  context: CliContext,
  layout: AppLayout,
  tooling: AppTooling,
  wanted: boolean,
): Promise<SignInPlan> {
  if (!wanted) {
    return {
      path: layout.signInPath,
      file: null,
      written: false,
      reason: 'You declined the sign-in page, so pidrang did not generate one',
    };
  }
  if (layout.signInRoute) {
    return {
      path: layout.signInPath,
      file: null,
      written: false,
      reason: `app.routes.ts already declares its own ${layout.signInPath} route, so pidrang left the sign-in page to it`,
    };
  }
  const file = signInFile(layout, tooling);
  const problem = await conflictReason(context.cwd, file);
  if (problem === null || problem === 'unchanged') {
    return {
      path: layout.signInPath,
      file: problem === null ? file : null,
      written: true,
      reason: '',
    };
  }
  return {
    path: layout.signInPath,
    file: null,
    written: true,
    reason: `${file.path} is already there and ${problem}, so pidrang left it as it is`,
  };
}

function printExistingAppNotice(
  context: CliContext,
  layout: AppLayout,
  planned: string | null,
): void {
  if (planned === null) {
    return;
  }
  context.out('');
  context.out(
    `The app already has its own pages and routes, so pidrang only added the resource routes to ${layout.routesFile}. To open the first generated page, add this route above the others:`,
  );
  context.out(
    `  { path: '', pathMatch: 'full', redirectTo: ${quote(planned)} },`,
  );
}

function printDiff(
  context: CliContext,
  path: string,
  before: string | null,
  after: string,
): void {
  context.out(`--- ${before === null ? '/dev/null' : `a/${path}`}`);
  context.out(`+++ b/${path}`);
  formatDiff(before ?? '', after).forEach((line) => context.out(line));
}

async function writeFiles(
  context: CliContext,
  plan: WritePlan,
): Promise<number> {
  const interrupt = context.watchInterrupt();
  try {
    const written = await applyWritePlan(context.cwd, plan, interrupt.signal);
    const touched = new Set(written);
    plan.create.forEach((file) => {
      if (!touched.has(file.path)) {
        return;
      }
      context.out('');
      context.out(`Wrote ${file.path}`);
      printDiff(context, file.path, null, file.content);
    });
    (plan.edits ?? []).forEach((edit) => {
      if (!touched.has(edit.path)) {
        return;
      }
      context.out('');
      context.out(
        `${edit.manual ? 'Needs a manual change' : 'Modified'} ${edit.path}${edit.reason ? `: ${edit.reason}` : ''}`,
      );
      printDiff(context, edit.path, edit.before, edit.after);
    });
    plan.unchanged.forEach((file) =>
      context.out(`Unchanged (already up to date) ${file.path}`),
    );
    if (written.length === 0) {
      context.out('Nothing to write: every file already matches.');
    }
    return EXIT_OK;
  } catch (error) {
    if (!(error instanceof WriteInterruptedError)) {
      throw error;
    }
    error.written.forEach((path) => context.err(`Wrote ${path}`));
    context.err(`\nWriting stopped: ${error.reason}.`);
    context.err(`Not written: ${error.remaining.join(', ')}.`);
    context.err(
      'Run pidrang init again with the same answers to write the rest: the files already written match and are left as they are.',
    );
    return error.reason === 'cancelled' ? EXIT_CANCELLED : EXIT_FAILED;
  } finally {
    interrupt.dispose();
  }
}

interface SetupReport {
  setup: AppSetup;
  signIn: { path: string | null; file: boolean; reason: string };
  edits: FileEditPlan[];
  environmentPath: string;
  environmentDevelopmentPath: string;
  createdEnvironment: boolean;
  environmentLines: string[];
}

function printInstructions(
  context: CliContext,
  layout: AppLayout,
  report: SetupReport,
): void {
  const manual = report.edits.filter((edit) => edit.manual);
  if (manual.length > 0) {
    context.out('');
    context.out(
      'pidrang could not edit these files safely. Each one now starts with a pidrang comment that lists the exact change to make:',
    );
    manual.forEach((edit) =>
      context.out(`  ${edit.path}: ${edit.reason ?? 'see the comment'}`),
    );
  }
  if (report.createdEnvironment) {
    context.out('');
    context.out(
      `Created ${report.environmentPath} and ${report.environmentDevelopmentPath}. Set the Supabase values there:`,
    );
    context.out(
      `  supabaseUrl: your project URL, from the Connect button at the top of the Supabase dashboard`,
    );
    context.out(
      `  supabasePublishableKey: the publishable key of the project (sb_publishable_..., or the legacy anon key), from the Connect button at the top of the Supabase dashboard`,
    );
  } else if (report.environmentLines.length > 0) {
    context.out('');
    context.out(`Add these lines to ${report.environmentPath}:`);
    report.environmentLines.forEach((line) => context.out(line));
  }
  report.setup.notes.forEach((note) => context.out(`\n${note}`));
  context.out('');
  if (report.signIn.path !== null) {
    const route = `provideSignInPath(${quote(report.signIn.path)}) in ${layout.configFile}`;
    if (report.signIn.file) {
      context.out(
        `The Sign in link of the layout and the sign-in prompts of the pages open ${report.signIn.path}, set by ${route}. pidrang generated the sign-in page at ${join(layout.appDirectory, 'pages', 'sign-in-page.ts')}.`,
      );
    } else {
      context.out(
        `The Sign in link of the layout and the sign-in prompts of the pages open ${report.signIn.path}, set by ${route}. pidrang did not generate the page there: ${report.signIn.reason}.`,
      );
    }
    return;
  }
  if (report.signIn.reason !== '') {
    context.out(
      `pidrang did not generate the sign-in page the pages and the layout link to: ${report.signIn.reason}.`,
    );
  }
  context.out(
    `When a write needs a signed-in user, the pages say so in plain text. To turn that into a link to your sign-in page, add this provider to your ${layout.configFile} and replace /your-sign-in-route with the path of that page inside your app:\n`,
  );
  context.out(SIGN_IN_PATH_SNIPPET);
}

interface InstallPlan {
  commands: Command[];
  unsupportedManager: string | null;
}

interface InstallResult {
  outcome: InstallOutcome;
  remaining: Command[];
}

async function planInstall(
  context: CliContext,
  setupPackages: string[],
): Promise<InstallPlan> {
  const missing = await missingPackages(
    context.cwd,
    requiredPackages(setupPackages, PAGES_UI_LAYER_PACKAGES),
    context.version,
  );
  const ngAdd = await missingPackages(
    context.cwd,
    PAGES_UI_LAYER_PACKAGES.ngAdd,
    context.version,
  );
  const choice = await detectPackageManager(context.cwd);
  return {
    commands: installCommands(
      'manager' in choice ? choice.manager : 'npm',
      pinPackages(missing, context.version),
      ngAdd,
    ),
    unsupportedManager: 'unsupported' in choice ? choice.unsupported : null,
  };
}

async function runInstallCommands(
  context: CliContext,
  commands: Command[],
): Promise<InstallResult> {
  const interrupt = context.watchInterrupt();
  try {
    for (const [index, command] of commands.entries()) {
      context.out('');
      context.out(`Running ${formatCommand(command)}`);
      const succeeded = await context.runCommand(command);
      if (interrupt.signal.aborted) {
        return { outcome: 'cancelled', remaining: commands.slice(index) };
      }
      if (!succeeded) {
        context.err('');
        context.err(`${formatCommand(command)} failed: see its output above.`);
        return { outcome: 'failed', remaining: commands.slice(index) };
      }
    }
    return { outcome: 'installed', remaining: [] };
  } finally {
    interrupt.dispose();
  }
}

async function installPackages(
  context: CliContext,
  plan: InstallPlan,
  skip: boolean,
): Promise<InstallResult> {
  const { commands } = plan;
  if (commands.length === 0) {
    return { outcome: 'present', remaining: [] };
  }
  if (plan.unsupportedManager !== null) {
    return { outcome: 'unsupported', remaining: commands };
  }
  if (skip) {
    return { outcome: 'skipped', remaining: commands };
  }
  context.out('');
  let accepted: boolean;
  try {
    accepted = await context.confirmInstall();
  } catch (error) {
    if (isPromptExit(error)) {
      return { outcome: 'cancelled', remaining: commands };
    }
    throw error;
  }
  if (!accepted) {
    return { outcome: 'skipped', remaining: commands };
  }
  return runInstallCommands(context, commands);
}

function printInstallReport(
  context: CliContext,
  plan: InstallPlan,
  result: InstallResult,
): void {
  context.out('');
  if (result.outcome === 'present') {
    context.out('The required packages are already installed.');
    return;
  }
  if (result.outcome === 'installed') {
    context.out('Installed the packages. Run ng build to check the app.');
    return;
  }
  context.out(
    result.outcome === 'unsupported'
      ? `pidrang cannot run ${plan.unsupportedManager}, the package manager this app names. Install the packages with it, then run ng build. With npm, the commands would be:`
      : 'Install the packages manually, then run ng build:',
  );
  result.remaining.forEach((command) =>
    context.out(`  ${formatCommand(command)}`),
  );
}

const INSTALL_STATUS: Record<InstallOutcome, number> = {
  installed: EXIT_OK,
  present: EXIT_OK,
  skipped: EXIT_OK,
  unsupported: EXIT_OK,
  failed: EXIT_FAILED,
  cancelled: EXIT_CANCELLED,
};

function signedInResources(
  generation: InitResult,
  newApp: boolean,
  signIn: SignInPlan,
): string[] {
  if (!newApp || !signIn.written) {
    return [];
  }
  return privateResources(generation);
}

function privateResources(generation: InitResult): string[] {
  return generation.tables
    .filter((table) => table.readsNeedSignIn)
    .map((table) => table.table);
}

function unguardedReadsMessage(
  tables: string[],
  newApp: boolean,
  signIn: SignInPlan,
): string {
  const names = tables.map((table) => JSON.stringify(table)).join(', ');
  const reason = newApp
    ? signIn.reason
    : 'pidrang only adds the guard to a new app, and this one keeps its own routes';
  return `${names}: reads need a signed-in user, but pidrang did not add the sign-in guard: ${reason}.`;
}

async function runInit(
  context: CliContext,
  options: InitOptions,
): Promise<number> {
  const { planPath } = options;
  const layout = await preflightApp(context.cwd, options.project);
  const pages = relocateFiles(
    generatePagesBundle().filter((file) => file.path !== SIGN_IN_PAGE_FILE),
    layout.appDirectory,
  );
  const pagesPlan = await planWrites(context.cwd, pages);
  if (pagesPlan.conflicts.length > 0) {
    reportConflicts(context, layout, pagesPlan);
    return EXIT_FAILED;
  }
  const tooling = context.tooling ?? (await loadAppTooling(context.cwd));
  const routesSource = await readFile(
    join(context.cwd, layout.routesFile),
    'utf8',
  );
  const htmlPath = posix.join(layout.appDirectory, 'app.html');
  const htmlSource = await readOptional(context.cwd, htmlPath);
  const newApp = isNewApp(
    tooling.typescript,
    routesSource,
    htmlSource,
    tooling.welcomeTemplate,
  );
  const [routesFile] = relocateFiles(
    [generateResourceRoutesFile()],
    layout.appDirectory,
  );
  const existingRoutes = newApp
    ? null
    : await readOptional(context.cwd, routesFile.path);
  const existingGuards =
    existingRoutes === null
      ? []
      : (existingSignedInGuards(existingRoutes, !layout.signInRoute) ?? []);
  const generation = await collectPlan(
    context,
    layout,
    planPath,
    newApp,
    existingGuards.length > 0,
  );
  const signIn = await planSignIn(context, layout, tooling, generation.signIn);
  const guardedResources =
    existingGuards.length === 0
      ? signedInResources(generation, newApp, signIn)
      : [
          ...existingGuards,
          ...(signIn.written ? privateResources(generation) : []).filter(
            (table) => !existingGuards.includes(table),
          ),
        ];
  const unguardedResources = privateResources(generation).filter(
    (table) => !guardedResources.includes(table),
  );
  if (unguardedResources.length > 0) {
    context.err(unguardedReadsMessage(unguardedResources, newApp, signIn));
  }
  const [resourceRoutes] = relocateFiles(
    [generateResourceRoutesFile(!layout.signInRoute, guardedResources)],
    layout.appDirectory,
  );
  const routesGuardEdit =
    existingRoutes !== null &&
    existingGuards.length > 0 &&
    guardedResources.length > existingGuards.length
      ? existingRoutes
      : null;
  if (!newApp && generation.layout === 'sidebar') {
    context.err(
      `${htmlPath} or ${layout.routesFile} is no longer the one ng new writes, so pidrang did not add the navigation layout.`,
    );
  }
  const componentPath = posix.join(layout.appDirectory, 'app.ts');
  const componentSource =
    newApp && generation.layout === 'sidebar'
      ? await readOptional(context.cwd, componentPath)
      : null;
  if (newApp && generation.layout === 'sidebar' && componentSource === null) {
    context.err(
      `${componentPath} was not found, so pidrang did not add the navigation layout.`,
    );
  }
  const withLayout = componentSource !== null;
  const signInPath = signIn.written ? layout.signInPath : undefined;
  const [generatedResources] = relocateFiles(
    [
      {
        path: 'src/app/resources.ts',
        content: generateResourcesFile(generation),
      },
    ],
    layout.appDirectory,
  );

  const environment = environmentPaths(layout.sourceRoot);
  const existingEnvironment = await readOptional(
    context.cwd,
    environment.default,
  );
  const existingDevelopment = await readOptional(
    context.cwd,
    environment.development,
  );
  const createdEnvironment =
    existingEnvironment === null && existingDevelopment === null;
  const environmentFilesToWrite = createdEnvironment
    ? environmentFiles(layout.sourceRoot, generation.setup.environment)
    : [];
  const noticeSource = existingEnvironment ?? existingDevelopment;
  const environmentLinesToAdd =
    createdEnvironment || noticeSource === null
      ? []
      : environmentLines(generation.setup.environment, noticeSource);

  const configSource = await readFile(
    join(context.cwd, layout.configFile),
    'utf8',
  );
  const configRequest: ConfigRequest = {
    setup: generation.setup,
    environmentImport: environmentImportPath(
      layout.appDirectory,
      layout.sourceRoot,
    ),
    resourcesImport: './resources',
    signInPath,
  };
  const configEdit = editAppConfig(
    tooling.typescript,
    layout.configFile,
    configSource,
    configRequest,
  );
  const routesEdit = editAppRoutes(
    tooling.typescript,
    layout.routesFile,
    routesSource,
    './resource-routes',
    newApp ? entryRedirect(generation) : null,
  );
  const htmlEdit =
    htmlSource === null
      ? { kind: 'unchanged' as const }
      : withLayout
        ? {
            kind: 'edited' as const,
            content: layoutAppHtml(layout.projectName),
          }
        : editAppHtml(htmlPath, htmlSource, tooling.welcomeTemplate);

  const specPath = posix.join(layout.appDirectory, 'app.spec.ts');
  const specSource =
    htmlEdit.kind === 'edited'
      ? await readOptional(context.cwd, specPath)
      : null;

  const existingResources = await readOptional(
    context.cwd,
    generatedResources.path,
  );
  const resourcesEdit =
    existingResources === null
      ? null
      : editResources(
          tooling.typescript,
          generatedResources.path,
          existingResources,
          generatedResources.content,
        );
  resourcesEdit?.kept.forEach((table) =>
    context.out(
      `${table} is already in ${generatedResources.path}, left as it is.`,
    ),
  );

  const candidates: FileEditPlan[] = [
    ...(existingResources === null || resourcesEdit === null
      ? []
      : editCandidate(
          generatedResources.path,
          existingResources,
          resourcesEdit,
        )),
    ...(routesGuardEdit === null
      ? []
      : [
          {
            path: resourceRoutes.path,
            before: routesGuardEdit,
            after: resourceRoutes.content,
            manual: false,
          },
        ]),
    ...editCandidate(layout.configFile, configSource, configEdit),
    ...editCandidate(layout.routesFile, routesSource, routesEdit),
    ...(htmlSource === null
      ? []
      : editCandidate(htmlPath, htmlSource, htmlEdit)),
    ...(componentSource === null
      ? []
      : editCandidate(
          componentPath,
          componentSource,
          editAppComponent(tooling.typescript, componentPath, componentSource),
        )),
    ...(specSource === null
      ? []
      : editCandidate(
          specPath,
          specSource,
          editAppSpec(tooling.typescript, specPath, specSource, withLayout),
        )),
  ];

  if (createdEnvironment) {
    const workspaceSource = await readOptional(context.cwd, 'angular.json');
    const workspaceAfter =
      workspaceSource === null
        ? null
        : addEnvironmentFileReplacements(
            workspaceSource,
            layout.project,
            layout.sourceRoot,
          );
    if (workspaceSource !== null && workspaceAfter !== null) {
      candidates.push({
        path: 'angular.json',
        before: workspaceSource,
        after: workspaceAfter,
        manual: false,
      });
    }
  }

  const layoutFiles = withLayout
    ? relocateFiles([generateLayoutFile(tooling.layoutUi)], layout.appDirectory)
    : [];
  const plan = await planWrites(context.cwd, [
    ...(existingResources === null ? [generatedResources] : []),
    ...pages,
    ...(routesGuardEdit === null ? [resourceRoutes] : []),
    ...environmentFilesToWrite,
    ...layoutFiles,
    ...(signIn.file === null ? [] : [signIn.file]),
  ]);
  const editPlan = await planEdits(context.cwd, candidates);
  const conflicts = [...plan.conflicts, ...editPlan.conflicts];
  if (conflicts.length > 0) {
    reportConflicts(context, layout, { ...plan, conflicts });
    return EXIT_FAILED;
  }
  const status = await writeFiles(context, { ...plan, edits: editPlan.edits });
  if (status !== EXIT_OK) {
    return status;
  }
  if (!newApp && !declaresEntryRoute(tooling.typescript, routesSource)) {
    printExistingAppNotice(context, layout, entryRedirect(generation));
  }
  const installPlan = await planInstall(context, generation.setup.packages);
  const installResult = await installPackages(
    context,
    installPlan,
    options.skipInstall || planPath !== undefined,
  );
  printInstructions(context, layout, {
    setup: generation.setup,
    edits: editPlan.edits,
    environmentPath: environment.default,
    environmentDevelopmentPath: environment.development,
    createdEnvironment,
    environmentLines: environmentLinesToAdd,
    signIn: {
      path: signInPath ?? null,
      file: signIn.file !== null,
      reason: signIn.reason,
    },
  });
  printInstallReport(context, installPlan, installResult);
  return INSTALL_STATUS[installResult.outcome];
}

const SIGN_IN_ONLY_SETUP: AppSetup = {
  imports: [],
  constants: [],
  pidrangConfig: [],
  environment: [],
  notes: [],
  packages: [],
};

const SIGN_IN_PROVIDER_CALL = /provideSignInPath\(\s*(['"`])([^'"`]*)\1\s*\)/;

function withSignInPath(
  typescript: AppTooling['typescript'],
  path: string,
  source: string,
  signInPath: string,
): string | null {
  const call = SIGN_IN_PROVIDER_CALL.exec(source);
  if (call !== null) {
    return call[2] === signInPath ? source : null;
  }
  const edit = editAppConfig(typescript, path, source, {
    setup: { ...SIGN_IN_ONLY_SETUP, packages: [] },
    environmentImport: null,
    resourcesImport: './resources',
    signInPath,
    signInOnly: true,
  });
  return edit.kind === 'unchanged' ? source : edit.content;
}

function reportGenerateConflicts(
  context: CliContext,
  conflicts: WriteConflict[],
): void {
  context.err(
    'pidrang generate auth stopped before writing anything: these files cannot be kept as they are:',
  );
  conflicts.forEach((item) => context.err(`  ${item.path}: ${item.reason}`));
}

function printGeneratedSignIn(
  context: CliContext,
  layout: AppLayout,
  edits: FileEditPlan[],
): void {
  const manual = edits.filter((edit) => edit.manual);
  if (manual.length > 0) {
    context.out('');
    context.out(
      'pidrang could not edit these files safely. Each one now starts with a pidrang comment that lists the exact change to make:',
    );
    manual.forEach((edit) =>
      context.out(`  ${edit.path}: ${edit.reason ?? 'see the comment'}`),
    );
  }
  context.out('');
  context.out(
    `The Sign in link of the layout and the sign-in prompts of the pages open ${layout.signInPath}, set by provideSignInPath(${quote(layout.signInPath)}) in ${layout.configFile}.`,
  );
}

async function runGenerateAuth(
  context: CliContext,
  options: { project?: string },
): Promise<number> {
  const layout = await preflightApp(context.cwd, options.project);
  if (layout.signInRoute) {
    context.out(
      `app.routes.ts already declares its own ${layout.signInPath} route, so pidrang left the sign-in page to it and wrote nothing.`,
    );
    return EXIT_OK;
  }
  const tooling = context.tooling ?? (await loadAppTooling(context.cwd));
  const file = signInFile(layout, tooling);
  const problem = await conflictReason(context.cwd, file);
  if (problem === 'unchanged') {
    context.out(
      `${file.path} is already the sign-in page pidrang generates for this app, so pidrang wrote nothing.`,
    );
    return EXIT_OK;
  }
  if (problem !== null) {
    context.err(
      `${file.path} is already there and ${problem}, so pidrang left it as it is and wrote nothing.`,
    );
    return EXIT_FAILED;
  }
  const routesSource = await readFile(
    join(context.cwd, layout.routesFile),
    'utf8',
  );
  const routesEdit = editAppRoutes(
    tooling.typescript,
    layout.routesFile,
    routesSource,
    './resource-routes',
    null,
  );
  const configSource = await readFile(
    join(context.cwd, layout.configFile),
    'utf8',
  );
  const configAfter = withSignInPath(
    tooling.typescript,
    layout.configFile,
    configSource,
    layout.signInPath,
  );
  if (configAfter === null) {
    context.err(
      `${layout.configFile} already calls provideSignInPath with another path, so pidrang wrote nothing. Change that path to ${quote(layout.signInPath)} to use the generated page, or keep your own sign-in page.`,
    );
    return EXIT_FAILED;
  }
  const candidates: FileEditPlan[] = [
    ...editCandidate(layout.routesFile, routesSource, routesEdit),
    ...editCandidate(
      layout.configFile,
      configSource,
      configAfter === configSource
        ? { kind: 'unchanged' }
        : { kind: 'edited', content: configAfter },
    ),
  ];
  const plan = await planWrites(context.cwd, [file]);
  const editPlan = await planEdits(context.cwd, candidates);
  const conflicts = [...plan.conflicts, ...editPlan.conflicts];
  if (conflicts.length > 0) {
    reportGenerateConflicts(context, conflicts);
    return EXIT_FAILED;
  }
  const status = await writeFiles(context, { ...plan, edits: editPlan.edits });
  if (status !== EXIT_OK) {
    return status;
  }
  printGeneratedSignIn(context, layout, editPlan.edits);
  return EXIT_OK;
}

export async function runCli(
  argv: string[],
  context: CliContext,
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        plan: { type: 'string' },
        project: { type: 'string' },
        'skip-install': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    context.err(error instanceof Error ? error.message : String(error));
    context.err(usage(context.providers));
    return EXIT_FAILED;
  }
  const { values, positionals } = parsed;
  if (values.help && positionals.length === 0) {
    context.out(usage(context.providers));
    return EXIT_OK;
  }
  const command = COMMANDS[positionals.join(' ')];
  if (command === undefined) {
    context.err(`Unknown command: ${positionals.join(' ')}`);
    context.err(usage(context.providers));
    return EXIT_FAILED;
  }
  if (values.help) {
    context.out(usage(context.providers));
    return EXIT_OK;
  }

  const nodeProblem = nodeVersionProblem(context.nodeVersion);
  if (nodeProblem !== null) {
    context.err(nodeProblem);
    context.err('Nothing was written.');
    return EXIT_FAILED;
  }

  try {
    if (command === 'generate auth') {
      return await runGenerateAuth(context, { project: values.project });
    }
    return await runInit(context, {
      planPath: values.plan,
      project: values.project,
      skipInstall: values['skip-install'] === true,
    });
  } catch (error) {
    if (isPromptExit(error)) {
      context.err('Cancelled: nothing was written.');
      if (!context.interactive) {
        context.err(
          'There is no terminal to answer the questions in: pass the answers with --plan <file>, see pidrang --help.',
        );
      }
      return EXIT_CANCELLED;
    }
    if (error instanceof UnsupportedAppError) {
      context.err('pidrang init cannot set up this folder:');
      error.problems.forEach((problem) => context.err(`  - ${problem}`));
      context.err('Nothing was written.');
      return EXIT_FAILED;
    }
    context.err(error instanceof Error ? error.message : String(error));
    context.err('Nothing was written.');
    return EXIT_FAILED;
  }
}
