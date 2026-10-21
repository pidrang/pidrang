import { access, readFile } from 'node:fs/promises';
import { join, posix, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  AppSetup,
  InitResult,
  PAGES_UI_LAYER_PACKAGES,
  PlanEnvironment,
  SIGN_IN_PATH_SNIPPET,
  SchemaProviderDefinition,
  generateLayoutFile,
  generatePagesBundle,
  generateResourceRoutesFile,
  generateResourcesFile,
  layoutAppHtml,
  layoutImport,
  parseInitPlan,
  runInitWizard,
  runScriptedInit,
} from '@pidrang/cli';
import { AppLayout, UnsupportedAppError, preflightApp } from './preflight-app';
import {
  WriteInterruptedError,
  WritePlan,
  FileEditPlan,
  applyWritePlan,
  planEdits,
  planWrites,
  relocateFiles,
} from './write-plan';
import { AppTooling, loadAppTooling } from './app-tooling';
import { ConfigRequest, FileEdit, editAppConfig } from './edit-app-config';
import { editAppRoutes, isNewApp } from './edit-app-routes';
import { editAppHtml } from './edit-app-html';
import { editAppSpec } from './edit-app-spec';
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
    '',
    'Scaffolds Resource definitions and CRUD pages into an Angular app. Run it from the workspace root.',
    '',
    'Options:',
    '  --plan <file>     Take the answers from a JSON plan file instead of prompts',
    '  --project <name>  The application to set up, when angular.json has several',
    '  --skip-install    Do not offer to install the packages, print the commands instead',
    '  -h, --help        Show this help',
    '',
    'Plan file:',
    '  {',
    '    "provider": "supabase",',
    '    "connection": { ... },',
    '    "tables": [',
    '      { "table": "products", "actions": ["list", "create", "show", "edit", "delete"], "hiddenFields": ["created_at"] }',
    '    ],',
    '    "layout": "sidebar"',
    '  }',
    '  actions lists at least one of list, create, show, edit, delete. hiddenFields is optional.',
    '  layout is "sidebar" to add a header and a side menu of the resources to a new app, or',
    '  "none" to leave the pages bare. It defaults to "none" and an existing app never gets one.',
    '  Credentials never go in the plan file: they come from environment variables.',
    '',
    ...providers.map((provider) => provider.planHelp),
    '',
    'It writes the resources, pages, helpers and resource routes, and it edits app.config.ts,',
    'app.routes.ts and app.html. When it replaces the welcome page, it also removes the welcome',
    'title test of app.spec.ts. It creates src/environments when the app has none. A file it',
    'writes is never overwritten: one that already exists with other content stops init before',
    'any write. When a file cannot be edited safely, init adds a "pidrang:" comment that lists the',
    'exact change to make.',
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
  unansweredResources = false,
): void {
  const resourcesFile = `${layout.appDirectory}/resources.ts`;
  context.err(
    'pidrang init stopped before writing anything: these files already exist and cannot be kept as they are:',
  );
  plan.conflicts.forEach((conflict) =>
    context.err(`  ${conflict.path}: ${conflict.reason}`),
  );
  if (unansweredResources) {
    context.err(
      `  ${resourcesFile}: exists too, and is compared with what your answers generate once the files above are out of the way`,
    );
  }
  context.err(
    `\npidrang never overwrites a file. If the pages or helpers come from an older pidrang init, delete ${layout.appDirectory}/pages and ${layout.appDirectory}/pidrang together (the pages need the matching helpers) and run it again. If ${resourcesFile} lists other tables or actions, delete it or move your changes out of it first.`,
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
): Promise<InitResult> {
  const options = {
    takenRoutes: layout.takenRoutes,
    isNewApp,
    reportLeftOutColumns: context.out,
    warn: context.err,
  };
  if (planPath === undefined) {
    return runInitWizard(context.providers, options);
  }
  const plan = parseInitPlan(await readPlanFile(context.cwd, planPath));
  return runScriptedInit(context.providers, plan, context.env, options);
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
  context.out(`  { path: '', pathMatch: 'full', redirectTo: '${planned}' },`);
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
  signInFile: string | null;
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
  if (report.signInFile !== null) {
    context.out('');
    context.out(
      `When a write needs a signed-in user, or the navigation asks for a sign-in page, the pages say so in plain text. To turn that into a link, pass this provider to your ${layout.configFile} and replace /your-sign-in-route with the path of your sign-in page inside the app:\n`,
    );
  } else {
    context.out('');
    context.out(
      `When a write needs a signed-in user, the pages say so in plain text. To turn that into a link to your sign-in page, add this provider to your ${layout.configFile} and replace /your-sign-in-route with the path of that page inside your app:\n`,
    );
  }
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

async function runInit(
  context: CliContext,
  options: InitOptions,
): Promise<number> {
  const { planPath } = options;
  const layout = await preflightApp(context.cwd, options.project);
  const pages = relocateFiles(
    [...generatePagesBundle(), generateResourceRoutesFile()],
    layout.appDirectory,
  );
  const pagesPlan = await planWrites(context.cwd, pages);
  if (pagesPlan.conflicts.length > 0) {
    const resourcesExist = await access(
      join(context.cwd, layout.appDirectory, 'resources.ts'),
    ).then(
      () => true,
      () => false,
    );
    reportConflicts(context, layout, pagesPlan, resourcesExist);
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
  const generation = await collectPlan(context, layout, planPath, newApp);
  const withLayout = newApp && generation.layout === 'sidebar';
  const signInPath = withLayout ? '/your-sign-in-route' : undefined;
  const signInPathFile = withLayout
    ? posix.join(layout.appDirectory, 'pidrang/index.ts')
    : null;
  const [resources] = relocateFiles(
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
    ...(signInPathFile === null ? {} : { signInPathFile }),
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
            content: `${layoutImport()}\n${layoutAppHtml(layout.projectName)}\n`,
          }
        : editAppHtml(htmlPath, htmlSource, tooling.welcomeTemplate);

  const specPath = posix.join(layout.appDirectory, 'app.spec.ts');
  const specSource =
    htmlEdit.kind === 'edited'
      ? await readOptional(context.cwd, specPath)
      : null;

  const candidates: FileEditPlan[] = [
    ...editCandidate(layout.configFile, configSource, configEdit),
    ...editCandidate(layout.routesFile, routesSource, routesEdit),
    ...(htmlSource === null
      ? []
      : editCandidate(htmlPath, htmlSource, htmlEdit)),
    ...(specSource === null
      ? []
      : editCandidate(
          specPath,
          specSource,
          editAppSpec(tooling.typescript, specPath, specSource),
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
    resources,
    ...pages,
    ...environmentFilesToWrite,
    ...layoutFiles,
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
  if (!newApp) {
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
    signInFile: signInPathFile,
  });
  printInstallReport(context, installPlan, installResult);
  return INSTALL_STATUS[installResult.outcome];
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
  const unknownCommand =
    positionals.length > 1 ||
    (positionals.length === 1 && positionals[0] !== 'init');
  if (unknownCommand) {
    context.err(`Unknown command: ${positionals.join(' ')}`);
    context.err(usage(context.providers));
    return EXIT_FAILED;
  }
  if (values.help) {
    context.out(usage(context.providers));
    return EXIT_OK;
  }
  if (positionals.length === 0) {
    context.err(usage(context.providers));
    return EXIT_FAILED;
  }

  const nodeProblem = nodeVersionProblem(context.nodeVersion);
  if (nodeProblem !== null) {
    context.err(nodeProblem);
    context.err('Nothing was written.');
    return EXIT_FAILED;
  }

  try {
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
