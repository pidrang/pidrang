import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  GenerationPlan,
  PlanEnvironment,
  RESOURCE_ROUTES_SNIPPET,
  SIGN_IN_PATH_SNIPPET,
  SchemaProviderDefinition,
  generatePagesBundle,
  generateResourcesFile,
  parseInitPlan,
  runInitWizard,
  runScriptedInit,
} from '@pidrang/cli';
import { AppLayout, UnsupportedAppError, preflightApp } from './preflight-app';
import {
  WriteInterruptedError,
  WritePlan,
  applyWritePlan,
  planWrites,
  relocateFiles,
} from './write-plan';

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
}

const ROUTES_EXPORT_SNIPPET = `export const routes: Routes = [...resourceRoutes];
`;

const PROVIDERS_SNIPPET = `provideRouter(routes, withComponentInputBinding()),
providePidrang({
  dataProvider: ...,
  resources: [...resources],
})`;

function usage(providers: SchemaProviderDefinition[]): string {
  return [
    'Usage: pidrang init [--plan <file>] [--project <name>]',
    '',
    'Scaffolds Resource definitions and CRUD pages into an Angular app. Run it from the workspace root.',
    '',
    'Options:',
    '  --plan <file>     Take the answers from a JSON plan file instead of prompts',
    '  --project <name>  The application to set up, when angular.json has several',
    '  -h, --help        Show this help',
    '',
    'Plan file:',
    '  {',
    '    "provider": "supabase",',
    '    "connection": { ... },',
    '    "tables": [',
    '      { "table": "products", "actions": ["list", "create", "show", "edit", "delete"], "hiddenFields": ["created_at"] }',
    '    ]',
    '  }',
    '  actions lists at least one of list, create, show, edit, delete. hiddenFields is optional.',
    '  Credentials never go in the plan file: they come from environment variables.',
    '',
    ...providers.map((provider) => provider.planHelp),
    '',
    'Nothing is written unless every file can be written. A file that already exists is never',
    'overwritten: an identical one is left as it is, a different one stops init before any write.',
    '',
    'Exit status: 0 done or nothing to do, 1 invalid input, unsupported app or conflicting file,',
    '130 cancelled.',
  ].join('\n');
}

function isPromptExit(error: unknown): boolean {
  return error instanceof Error && error.name === 'ExitPromptError';
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

function printInstructions(context: CliContext, layout: AppLayout): void {
  context.out(
    `\nAdd these routes to your ${layout.routesFile}, above any other :resource-like route:\n`,
  );
  context.out(RESOURCE_ROUTES_SNIPPET);
  context.out(
    'Then add them to the routes your app exports. Keep your own fixed paths (such as sign-in) above ...resourceRoutes, and a ** route below it:\n',
  );
  context.out(ROUTES_EXPORT_SNIPPET);
  context.out(
    `In your ${layout.configFile}, replace provideRouter(routes) with the provideRouter line below and add providePidrang. The pages read :resource and :id as component inputs, so the router needs withComponentInputBinding():\n`,
  );
  context.out(PROVIDERS_SNIPPET);
  if (!layout.bindsComponentInputs) {
    context.out(
      `\n${layout.configFile} does not mention withComponentInputBinding() yet: until the router uses it, the list and show pages get no resource or id and stay blank.`,
    );
  }
  context.out(
    `\nWhen a write needs a signed-in user, the pages say so in plain text. To turn that into a link to your sign-in page, add this provider to your ${layout.configFile} and replace /your-sign-in-route with the path of that page inside your app:\n`,
  );
  context.out(SIGN_IN_PATH_SNIPPET);
}

async function collectPlan(
  context: CliContext,
  layout: AppLayout,
  planPath: string | undefined,
): Promise<GenerationPlan> {
  const options = { takenRoutes: layout.takenRoutes };
  if (planPath === undefined) {
    return runInitWizard(context.providers, options);
  }
  const plan = parseInitPlan(await readPlanFile(context.cwd, planPath));
  return runScriptedInit(context.providers, plan, context.env, options);
}

async function writeFiles(
  context: CliContext,
  plan: WritePlan,
): Promise<number> {
  const interrupt = context.watchInterrupt();
  try {
    const written = await applyWritePlan(context.cwd, plan, interrupt.signal);
    written.forEach((path) => context.out(`Wrote ${path}`));
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

async function runInit(
  context: CliContext,
  planPath: string | undefined,
  project: string | undefined,
): Promise<number> {
  const layout = await preflightApp(context.cwd, project);
  const pages = relocateFiles(generatePagesBundle(), layout.appDirectory);
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
  const generation = await collectPlan(context, layout, planPath);
  const [resources] = relocateFiles(
    [
      {
        path: 'src/app/resources.ts',
        content: generateResourcesFile(generation),
      },
    ],
    layout.appDirectory,
  );
  const plan = await planWrites(context.cwd, [resources, ...pages]);
  if (plan.conflicts.length > 0) {
    reportConflicts(context, layout, plan);
    return EXIT_FAILED;
  }
  const status = await writeFiles(context, plan);
  if (status === EXIT_OK) {
    printInstructions(context, layout);
  }
  return status;
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

  try {
    return await runInit(context, values.plan, values.project);
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
