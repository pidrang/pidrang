import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  AppSetup,
  SchemaProviderDefinition,
  generatePagesBundle,
} from '@pidrang/cli';
import * as typescript from 'typescript';
import { AppTooling } from './app-tooling';
import { CliContext, runCli } from './run-cli';

const SECRET = 'fake-secret-value';

const SETUP: AppSetup = {
  imports: [
    { name: 'providePidrang', from: '@pidrang/core' },
    { name: 'createClient', from: '@supabase/supabase-js' },
  ],
  constants: [
    {
      name: 'client',
      initializer:
        'createClient(environment.supabaseUrl, environment.supabaseAnonKey)',
    },
  ],
  pidrangConfig: [{ name: 'dataProvider', value: 'provideFake({ client })' }],
  environment: [
    { name: 'supabaseUrl', value: 'https://abc.supabase.co' },
    { name: 'supabaseAnonKey', value: 'YOUR-ANON-KEY' },
  ],
  notes: ['Use the anon key in the browser, never the service role key.'],
};

const STOCK_FILES: Record<string, string> = {
  'angular.json': JSON.stringify({
    projects: { shop: { projectType: 'application', sourceRoot: 'src' } },
  }),
  'package.json': JSON.stringify({
    dependencies: { '@angular/core': '^22.1.0' },
  }),
  'src/app/app.config.ts': 'export const appConfig = { providers: [] };',
  'src/app/app.routes.ts': 'export const routes: Routes = [];',
};

const NG_CONFIG = `import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes)
  ]
};
`;

const NG_ROUTES = `import { Routes } from '@angular/router';

export const routes: Routes = [];
`;

const NG_HTML = `<div class="welcome">Welcome</div>
<router-outlet />`;

const STRUCTURAL: AppTooling = {
  typescript,
  welcomeTemplate: NG_HTML,
};

function fakeProvider(): SchemaProviderDefinition<{ key: string }> {
  return {
    id: 'fake',
    label: 'Fake',
    planHelp: 'Fake plan connection: {} with the key from FAKE_KEY',
    promptConnection: vi.fn().mockResolvedValue({ key: SECRET }),
    connectionFromPlan: vi.fn(async (_connection, env) => {
      if (!env['FAKE_KEY']) {
        throw new Error('Invalid connection in the plan: set FAKE_KEY.');
      }
      return { key: env['FAKE_KEY'] };
    }),
    createSchemaProvider: vi.fn(() => ({
      listTables: vi.fn().mockResolvedValue(['products', 'orders']),
      introspectTable: vi.fn().mockResolvedValue({
        fields: [
          { name: 'id', type: 'number', readOnly: true },
          { name: 'name', type: 'text' },
        ],
        excludedColumns: [],
        unavailableActions: [],
      }),
    })),
    appSetup: vi.fn(() => SETUP),
  };
}

const PLAN = {
  provider: 'fake',
  connection: {},
  tables: [{ table: 'products', actions: ['list', 'show'] }],
};

describe('runCli', () => {
  let root: string;
  let out: string[];
  let err: string[];
  let provider: SchemaProviderDefinition<{ key: string }>;
  let interruptSignal: AbortSignal;

  function context(
    env: Record<string, string> = { FAKE_KEY: SECRET },
    tooling?: AppTooling,
  ): CliContext {
    return {
      providers: [provider],
      cwd: root,
      env,
      out: (line) => out.push(line),
      err: (line) => err.push(line),
      watchInterrupt: () => ({
        signal: interruptSignal,
        dispose: () => undefined,
      }),
      interactive: true,
      tooling,
    };
  }

  async function put(files: Record<string, string>): Promise<void> {
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), content, 'utf8');
    }
  }

  async function planFile(plan: unknown, path = 'plan.json'): Promise<string> {
    await put({
      [path]: typeof plan === 'string' ? plan : JSON.stringify(plan),
    });
    return path;
  }

  async function listFiles(directory = ''): Promise<string[]> {
    const entries = await readdir(join(root, directory), {
      withFileTypes: true,
    });
    const files = await Promise.all(
      entries.map((entry) => {
        const path = directory ? `${directory}/${entry.name}` : entry.name;
        return entry.isDirectory() ? listFiles(path) : [path];
      }),
    );
    return files.flat().sort();
  }

  async function snapshot(): Promise<Record<string, string>> {
    const files = await listFiles();
    const contents = await Promise.all(
      files.map((path) => readFile(join(root, path), 'utf8')),
    );
    return Object.fromEntries(
      files.map((path, index) => [path, contents[index]]),
    );
  }

  const output = () => [...out, ...err].join('\n');
  const generatedPaths = [
    'src/app/resources.ts',
    ...generatePagesBundle().map((file) => file.path),
    'src/app/resource-routes.ts',
    'src/environments/environment.ts',
    'src/environments/environment.development.ts',
  ];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pidrang-run-cli-'));
    out = [];
    err = [];
    provider = fakeProvider();
    interruptSignal = new AbortController().signal;
    await put(STOCK_FILES);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe('arguments', () => {
    it.each([['--help'], ['-h'], ['init', '--help']])(
      'prints the help for %s and succeeds',
      async (...argv) => {
        expect(await runCli(argv, context())).toBe(0);
        expect(out.join('\n')).toContain(
          'Usage: pidrang init [--plan <file>] [--project <name>]',
        );
        expect(out.join('\n')).toContain('Fake plan connection');
        expect(err).toEqual([]);
      },
    );

    it.each([
      [[], 'Usage: pidrang init'],
      [['build'], 'Unknown command: build'],
      [['build', '--help'], 'Unknown command: build'],
      [['--help', 'init', 'extra'], 'Unknown command: init extra'],
      [['init', 'extra'], 'Unknown command: init extra'],
      [['init', '--force'], "Unknown option '--force'"],
      [['init', '--plan'], "Option '--plan <value>' argument missing"],
    ])('refuses %j', async (argv, message) => {
      expect(await runCli(argv, context())).toBe(1);
      expect(err.join('\n')).toContain(message);
      expect(err.join('\n')).toContain('Usage: pidrang init');
      expect(provider.connectionFromPlan).not.toHaveBeenCalled();
      expect(provider.promptConnection).not.toHaveBeenCalled();
    });
  });

  describe('a scripted init', () => {
    it('writes resources.ts and the whole pages bundle into a stock app', async () => {
      const plan = await planFile(PLAN);

      expect(await runCli(['init', '--plan', plan], context())).toBe(0);

      expect(await listFiles()).toEqual(
        [...Object.keys(STOCK_FILES), 'plan.json', ...generatedPaths].sort(),
      );
      expect(
        await readFile(join(root, 'src/app/resources.ts'), 'utf8'),
      ).toContain("name: 'products'");
      expect(out).toContain('Wrote src/app/resources.ts');
      expect(out).toContain('--- /dev/null');
      expect(out).toContain('+++ b/src/app/resources.ts');
      expect(out).toContain(
        'Needs a manual change src/app/app.config.ts: TypeScript is not installed in this app',
      );
      expect(err).toEqual([]);
    });

    it('names the columns it leaves out before writing, and only then', async () => {
      const plan = await planFile(PLAN);
      expect(await runCli(['init', '--plan', plan], context())).toBe(0);
      expect(output()).not.toContain('left out');

      await rm(join(root, 'src/app/resources.ts'));
      out = [];
      vi.mocked(provider.createSchemaProvider).mockReturnValue({
        listTables: vi.fn().mockResolvedValue(['products']),
        introspectTable: vi.fn().mockResolvedValue({
          fields: [
            { name: 'id', type: 'number', readOnly: true },
            { name: 'name', type: 'text' },
          ],
          excludedColumns: [{ name: 'quantity', reason: 'int32' }],
          unavailableActions: [],
        }),
      });

      expect(await runCli(['init', '--plan', plan], context())).toBe(0);
      const leftOut = out.indexOf(
        '"products": These columns are left out: quantity (int32).',
      );
      expect(leftOut).toBeGreaterThanOrEqual(0);
      expect(leftOut).toBeLessThan(out.indexOf('Wrote src/app/resources.ts'));
      expect(err).toEqual([]);
    });

    it('edits app.config.ts, app.routes.ts and app.html when TypeScript is available', async () => {
      await put({
        'src/app/app.config.ts': NG_CONFIG,
        'src/app/app.routes.ts': NG_ROUTES,
        'src/app/app.html': NG_HTML,
      });
      const plan = await planFile(PLAN);

      expect(
        await runCli(['init', '--plan', plan], context(undefined, STRUCTURAL)),
      ).toBe(0);

      const config = await readFile(
        join(root, 'src/app/app.config.ts'),
        'utf8',
      );
      expect(config).toContain(
        "import { provideRouter, withComponentInputBinding } from '@angular/router';",
      );
      expect(config).toContain(
        "import { providePidrang } from '@pidrang/core';",
      );
      expect(config).toContain(
        "import { createClient } from '@supabase/supabase-js';",
      );
      expect(config).toContain(
        "import { environment } from '../environments/environment';",
      );
      expect(config).toContain("import { resources } from './resources';");
      expect(config).toContain(
        'const client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);',
      );
      expect(config).toContain(
        'provideRouter(routes, withComponentInputBinding()),',
      );
      expect(config).toContain('providePidrang({');
      expect(config).toContain('      dataProvider: provideFake({ client }),');
      expect(config).toContain('      resources,');

      const routes = await readFile(
        join(root, 'src/app/app.routes.ts'),
        'utf8',
      );
      expect(routes).toContain(
        "import { resourceRoutes } from './resource-routes';",
      );
      expect(routes).toContain(
        'export const routes: Routes = [\n  ...resourceRoutes,\n];',
      );

      expect(await readFile(join(root, 'src/app/app.html'), 'utf8')).toBe(
        '<router-outlet />\n',
      );

      expect(out).toContain('Modified src/app/app.config.ts');
      expect(out).toContain('--- a/src/app/app.config.ts');
      expect(out).toContain('+++ b/src/app/app.config.ts');
      expect(out).toContain('-    provideRouter(routes)');
      expect(out).toContain(
        '+    provideRouter(routes, withComponentInputBinding()),',
      );
      expect(err).toEqual([]);
    });

    it.each([
      ['already has an outlet', '<main><router-outlet /></main>\n', null],
      ['has no outlet', '<main>Custom</main>\n', '<!-- pidrang:'],
    ])('handles an app.html that %s', async (_, html, marker) => {
      await put({ 'src/app/app.html': html });
      const plan = await planFile(PLAN);

      expect(
        await runCli(['init', '--plan', plan], context(undefined, STRUCTURAL)),
      ).toBe(0);

      const content = await readFile(join(root, 'src/app/app.html'), 'utf8');
      if (marker === null) {
        expect(content).toBe(html);
      } else {
        expect(content).toContain(marker);
        expect(content).toContain('<router-outlet />');
        expect(out.join('\n')).toContain(
          'Needs a manual change src/app/app.html: app.html was customized and has no router outlet',
        );
      }
      expect(err).toEqual([]);
    });

    it('keeps the environment files it finds and prints the values to add', async () => {
      await put({
        'src/environments/environment.ts': 'export const environment = {};\n',
        'src/environments/environment.development.ts':
          'export const environment = {};\n',
      });
      const plan = await planFile(PLAN);

      expect(await runCli(['init', '--plan', plan], context())).toBe(0);

      expect(
        await readFile(join(root, 'src/environments/environment.ts'), 'utf8'),
      ).toBe('export const environment = {};\n');
      expect(out).toContain(
        'Add these lines to src/environments/environment.ts:',
      );
      expect(out).toContain("  supabaseUrl: 'https://abc.supabase.co',");
      expect(out).toContain("  supabaseAnonKey: 'YOUR-ANON-KEY',");
      expect(out.join('\n')).toContain(
        'Use the anon key in the browser, never the service role key.',
      );
    });

    it('adds the development environment file to angular.json when it creates the files', async () => {
      await put({
        'angular.json': JSON.stringify({
          projects: {
            shop: {
              projectType: 'application',
              sourceRoot: 'src',
              architect: {
                build: {
                  defaultConfiguration: 'production',
                  configurations: {
                    production: { budgets: [] },
                    development: { optimization: false },
                  },
                },
              },
            },
          },
        }),
      });
      const plan = await planFile(PLAN);

      expect(await runCli(['init', '--plan', plan], context())).toBe(0);

      const workspace = JSON.parse(
        await readFile(join(root, 'angular.json'), 'utf8'),
      );
      const configurations =
        workspace.projects.shop.architect.build.configurations;
      expect(configurations.development.fileReplacements).toEqual([
        {
          replace: 'src/environments/environment.ts',
          with: 'src/environments/environment.development.ts',
        },
      ]);
      expect(configurations.production.fileReplacements).toBeUndefined();
    });

    it('leaves everything as it is on a second identical run', async () => {
      const plan = await planFile(PLAN);
      await runCli(['init', '--plan', plan], context());
      const before = await snapshot();
      out = [];

      expect(await runCli(['init', '--plan', plan], context())).toBe(0);

      expect(await snapshot()).toEqual(before);
      expect(out).toContain('Nothing to write: every file already matches.');
      expect(out.filter((line) => line.startsWith('Wrote'))).toEqual([]);
    });

    it('writes only the missing files when the others already match', async () => {
      const plan = await planFile(PLAN);
      await runCli(['init', '--plan', plan], context());
      await rm(join(root, 'src/app/pages'), { recursive: true });
      out = [];

      expect(await runCli(['init', '--plan', plan], context())).toBe(0);

      expect(out.filter((line) => line.startsWith('Wrote')).sort()).toEqual(
        generatedPaths
          .filter((path) => path.startsWith('src/app/pages/'))
          .map((path) => `Wrote ${path}`)
          .sort(),
      );
      expect(await listFiles('src/app')).toEqual(
        generatedPaths
          .filter((path) => path.startsWith('src/app/'))
          .concat(
            Object.keys(STOCK_FILES).filter((path) => path.startsWith('src/')),
          )
          .sort(),
      );
    });

    it.each([
      ['a page edited by hand', 'src/app/pages/resource-list-page.ts'],
      ['a helper from an older pidrang', 'src/app/pidrang/index.ts'],
      ['resources.ts from other answers', 'src/app/resources.ts'],
    ])('writes nothing at all when %s is in the way', async (_, path) => {
      await put({ [path]: 'kept\n' });
      const plan = await planFile(PLAN);
      const before = await snapshot();

      expect(await runCli(['init', '--plan', plan], context())).toBe(1);

      expect(await snapshot()).toEqual(before);
      expect(err).toContain(
        `  ${path}: differs from what this pidrang version generates`,
      );
      expect(err.join('\n')).toContain('pidrang never overwrites a file');
      expect(out).toEqual([]);
    });

    it('lists every conflict at once', async () => {
      await put({
        'src/app/resources.ts': 'old\n',
        'src/app/pages/resource-edit-page.ts': 'old\n',
      });
      const plan = await planFile(PLAN);

      expect(await runCli(['init', '--plan', plan], context())).toBe(1);
      expect(err.filter((line) => line.startsWith('  src/'))).toEqual([
        '  src/app/pages/resource-edit-page.ts: differs from what this pidrang version generates',
        '  src/app/resources.ts: exists too, and is compared with what your answers generate once the files above are out of the way',
      ]);
      expect(provider.connectionFromPlan).not.toHaveBeenCalled();
    });

    it('lists every page in the way at once and no resources.ts that is not there', async () => {
      await put({
        'src/app/pages/resource-edit-page.ts': 'old\n',
        'src/app/pidrang/save-lock.ts': 'old\n',
      });
      const plan = await planFile(PLAN);

      expect(await runCli(['init', '--plan', plan], context())).toBe(1);
      expect(err.filter((line) => line.startsWith('  src/'))).toEqual([
        '  src/app/pidrang/save-lock.ts: differs from what this pidrang version generates',
        '  src/app/pages/resource-edit-page.ts: differs from what this pidrang version generates',
      ]);
    });

    it('fails a second run with other answers instead of mixing them', async () => {
      await runCli(['init', '--plan', await planFile(PLAN)], context());
      const before = await snapshot();
      const other = await planFile(
        {
          ...PLAN,
          tables: [{ table: 'orders', actions: ['list'] }],
        },
        'other.json',
      );
      const withOther = await snapshot();

      expect(await runCli(['init', '--plan', other], context())).toBe(1);
      expect(await snapshot()).toEqual(withOther);
      expect(Object.keys(withOther).length).toBe(
        Object.keys(before).length + 1,
      );
      expect(err).toContain(
        '  src/app/resources.ts: differs from what this pidrang version generates',
      );
    });

    it('writes into the app the --project option names', async () => {
      await put({
        'angular.json': JSON.stringify({
          projects: {
            shop: { projectType: 'application', sourceRoot: 'src' },
            admin: { projectType: 'application', sourceRoot: 'admin/src' },
          },
        }),
        'admin/src/app/app.config.ts': '',
        'admin/src/app/app.routes.ts': '',
      });
      const plan = await planFile(PLAN);

      expect(
        await runCli(['init', '--plan', plan, '--project', 'admin'], context()),
      ).toBe(0);
      expect(await listFiles('admin/src/app/pages')).toEqual(
        generatedPaths
          .filter((path) => path.startsWith('src/app/pages/'))
          .map((path) => `admin/${path}`)
          .sort(),
      );
      expect(await listFiles('src/app')).toEqual([
        'src/app/app.config.ts',
        'src/app/app.routes.ts',
      ]);
      expect(out.join('\n')).toContain('admin/src/app/app.routes.ts');
    });

    it('refuses an app it does not recognize before reading any credential', async () => {
      await rm(join(root, 'src/app/app.routes.ts'));
      const plan = await planFile(PLAN);
      const before = await snapshot();

      expect(await runCli(['init', '--plan', plan], context())).toBe(1);

      expect(await snapshot()).toEqual(before);
      expect(err[0]).toBe('pidrang init cannot set up this folder:');
      expect(err).toContain('Nothing was written.');
      expect(provider.connectionFromPlan).not.toHaveBeenCalled();
    });

    it('refuses a table named after a route of the app', async () => {
      await put({
        'src/app/app.routes.ts':
          "export const routes = [{ path: 'products' }];",
      });
      const plan = await planFile(PLAN);

      expect(await runCli(['init', '--plan', plan], context())).toBe(1);
      expect(err.join('\n')).toContain(
        '"products" collides with a route your app.routes.ts already declares',
      );
      expect(await listFiles('src/app')).toEqual([
        'src/app/app.config.ts',
        'src/app/app.routes.ts',
      ]);
    });

    it.each([
      ['a missing file', null, 'Could not read the plan file at "plan.json".'],
      [
        'a file that is not JSON',
        `{ "provider": "fake", "connection": { "key": "${SECRET}" `,
        'The plan file at "plan.json" is not valid JSON.',
      ],
      [
        'a malformed plan',
        {
          ...PLAN,
          connection: { key: SECRET },
          tables: [{ table: 'products', actions: [] }],
        },
        'Invalid plan: tables[0].actions must list at least one action.',
      ],
      [
        'an unknown table',
        { ...PLAN, tables: [{ table: 'nope', actions: ['list'] }] },
        'These tables are not among the tables this connection can scaffold: "nope".',
      ],
    ])(
      'refuses %s with nothing written and no secret printed',
      async (_, plan, message) => {
        if (plan !== null) {
          await planFile(plan);
        }
        const before = await snapshot();

        expect(await runCli(['init', '--plan', 'plan.json'], context())).toBe(
          1,
        );

        expect(await snapshot()).toEqual(before);
        expect(err).toContain(message);
        expect(err).toContain('Nothing was written.');
        expect(output()).not.toContain(SECRET);
      },
    );

    it('refuses a missing credential before connecting', async () => {
      const plan = await planFile(PLAN);

      expect(await runCli(['init', '--plan', plan], context({}))).toBe(1);
      expect(err).toContain('Invalid connection in the plan: set FAKE_KEY.');
      expect(provider.createSchemaProvider).not.toHaveBeenCalled();
    });

    it('never prints the credential it was given', async () => {
      const plan = await planFile(PLAN);

      expect(await runCli(['init', '--plan', plan], context())).toBe(0);
      expect(output()).not.toContain(SECRET);
    });

    it('says what was written and what is left when cancelled while writing', async () => {
      const controller = new AbortController();
      controller.abort();
      interruptSignal = controller.signal;
      const plan = await planFile(PLAN);

      expect(await runCli(['init', '--plan', plan], context())).toBe(130);

      expect(err).toContain('\nWriting stopped: cancelled.');
      expect(err).toContain(
        `Not written: ${[...generatedPaths, 'src/app/app.config.ts', 'src/app/app.routes.ts'].join(', ')}.`,
      );
      expect(await listFiles('src/app')).toEqual([
        'src/app/app.config.ts',
        'src/app/app.routes.ts',
      ]);
    });
  });

  describe('an interactive init', () => {
    it('exits with 130 and writes nothing when the prompts are cancelled', async () => {
      const cancelled = new Error('User force closed the prompt with SIGINT');
      cancelled.name = 'ExitPromptError';
      vi.mocked(provider.promptConnection).mockRejectedValueOnce(cancelled);
      const before = await snapshot();

      expect(await runCli(['init'], context())).toBe(130);

      expect(err).toEqual(['Cancelled: nothing was written.']);
      expect(await snapshot()).toEqual(before);
    });

    it('points to --plan when the prompts close because there is no terminal', async () => {
      const closed = new Error('User force closed the prompt');
      closed.name = 'ExitPromptError';
      vi.mocked(provider.promptConnection).mockRejectedValueOnce(closed);

      expect(await runCli(['init'], { ...context(), interactive: false })).toBe(
        130,
      );
      expect(err).toEqual([
        'Cancelled: nothing was written.',
        'There is no terminal to answer the questions in: pass the answers with --plan <file>, see pidrang --help.',
      ]);
    });

    it('reports a page in the way before asking anything', async () => {
      await put({ 'src/app/pidrang/index.ts': 'old\n' });

      expect(await runCli(['init'], context())).toBe(1);
      expect(err).toContain(
        '  src/app/pidrang/index.ts: differs from what this pidrang version generates',
      );
      expect(provider.promptConnection).not.toHaveBeenCalled();
    });

    it('checks the app before asking anything', async () => {
      await rm(join(root, 'angular.json'));

      expect(await runCli(['init'], context())).toBe(1);
      expect(provider.promptConnection).not.toHaveBeenCalled();
    });
  });
});
