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
import { checkbox } from '@inquirer/prompts';
import {
  AppSetup,
  SchemaProviderDefinition,
  generatePagesBundle,
} from '@pidrang/cli';
import * as typescript from 'typescript';
import { AppTooling } from './app-tooling';
import { RunCommand } from './install-packages';
import { CliContext, runCli } from './run-cli';

vi.mock('@inquirer/prompts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@inquirer/prompts')>()),
  checkbox: vi.fn(),
}));

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
        'createClient(environment.supabaseUrl, environment.supabasePublishableKey)',
    },
  ],
  pidrangConfig: [{ name: 'dataProvider', value: 'provideFake({ client })' }],
  environment: [
    { name: 'supabaseUrl', value: 'https://abc.supabase.co' },
    { name: 'supabasePublishableKey', value: 'YOUR-PUBLISHABLE-KEY' },
  ],
  notes: ['Use the publishable key in the browser, never the secret key.'],
  packages: ['@pidrang/fake', 'fake-client'],
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

const NG_HTML = `<div class="welcome">Congratulations! Your app is running.</div>
<router-outlet />`;

const NG_SPEC_AFTER = `import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  it('should create the app', () => {
    expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
  });
});
`;

const NG_SPEC = NG_SPEC_AFTER.replace(
  '\n});\n',
  `

  it('should render title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, admin');
  });
});
`,
);

const STRUCTURAL: AppTooling = {
  typescript,
  welcomeTemplate: NG_HTML,
  layoutUi: 'material',
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
  let confirmInstall: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  let runCommand: ReturnType<typeof vi.fn<RunCommand>>;

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
      nodeVersion: '24.15.0',
      version: '9.8.7',
      confirmInstall,
      runCommand,
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
    confirmInstall = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    runCommand = vi.fn<RunCommand>().mockResolvedValue(true);
    vi.mocked(checkbox).mockImplementation((async ({
      message,
    }: {
      message: string;
    }) =>
      message.startsWith('Which tables')
        ? ['products']
        : message.startsWith('Any fields')
          ? []
          : ['list', 'show']) as unknown as typeof checkbox);
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
          'Usage: pidrang init [--plan <file>] [--project <name>] [--skip-install]',
        );
        expect(out.join('\n')).toContain('"layout": "sidebar"');
        expect(out.join('\n')).toContain(
          'layout is "sidebar" to add a header and a side menu of the resources to a new app',
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
        'const client = createClient(environment.supabaseUrl, environment.supabasePublishableKey);',
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
      expect(routes).toBe(`import { Routes } from '@angular/router';
import { resourceRoutes } from './resource-routes';

export const routes: Routes = [
  ...resourceRoutes,
  { path: '', pathMatch: 'full', redirectTo: '/products' },
];
`);

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

    it.each([
      ['replaces the welcome page', NG_HTML, NG_SPEC_AFTER],
      [
        'keeps a customized app.html',
        '<main><router-outlet /></main>\n',
        NG_SPEC,
      ],
    ])(
      'edits the title test of app.spec.ts only when init %s',
      async (_, html, expected) => {
        await put({ 'src/app/app.html': html, 'src/app/app.spec.ts': NG_SPEC });
        const plan = await planFile(PLAN);

        expect(
          await runCli(
            ['init', '--plan', plan],
            context(undefined, STRUCTURAL),
          ),
        ).toBe(0);

        expect(await readFile(join(root, 'src/app/app.spec.ts'), 'utf8')).toBe(
          expected,
        );
        expect(out.includes('Modified src/app/app.spec.ts')).toBe(
          expected !== NG_SPEC,
        );
        expect(err).toEqual([]);
      },
    );

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
      expect(out).toContain(
        "  supabasePublishableKey: 'YOUR-PUBLISHABLE-KEY',",
      );
      expect(out.join('\n')).toContain(
        'Use the publishable key in the browser, never the secret key.',
      );
    });

    it('leaves an app wired with supabaseAnonKey as it is and prints the new line', async () => {
      await put({
        'src/app/app.config.ts': NG_CONFIG,
        'src/app/app.routes.ts': NG_ROUTES,
        'src/app/app.html': NG_HTML,
      });
      const plan = await planFile(PLAN);
      await runCli(['init', '--plan', plan], context(undefined, STRUCTURAL));
      const wired = [
        'src/app/app.config.ts',
        'src/environments/environment.ts',
        'src/environments/environment.development.ts',
      ];
      for (const path of wired) {
        const text = await readFile(join(root, path), 'utf8');
        await writeFile(
          join(root, path),
          text.replaceAll('supabasePublishableKey', 'supabaseAnonKey'),
          'utf8',
        );
      }
      const before = await snapshot();
      out = [];

      expect(
        await runCli(['init', '--plan', plan], context(undefined, STRUCTURAL)),
      ).toBe(0);

      expect(await snapshot()).toEqual(before);
      expect(before['src/app/app.config.ts']).toContain(
        'createClient(environment.supabaseUrl, environment.supabaseAnonKey)',
      );
      expect(out).toContain(
        'Add these lines to src/environments/environment.ts:',
      );
      expect(out).toContain(
        "  supabasePublishableKey: 'YOUR-PUBLISHABLE-KEY',",
      );
      expect(out).not.toContain("  supabaseUrl: 'https://abc.supabase.co',");
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
      expect(out).toContain(
        '  supabasePublishableKey: the publishable key of the project (sb_publishable_..., or the legacy anon key), from the Connect button at the top of the Supabase dashboard',
      );
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

    it('opens the redirect init adds on a new app and leaves the route one already has', async () => {
      await put({
        'src/app/app.html': NG_HTML,
        'src/app/app.routes.ts': `import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', component: HomePage },
];
`,
      });
      const plan = await planFile(PLAN);

      expect(
        await runCli(['init', '--plan', plan], context(undefined, STRUCTURAL)),
      ).toBe(0);

      const routes = await readFile(
        join(root, 'src/app/app.routes.ts'),
        'utf8',
      );
      expect(routes).toContain("  { path: '', component: HomePage },");
      expect(routes).not.toContain('pathMatch');
    });

    it('prints the redirect a new app should have when it cannot add one', async () => {
      await put({
        'src/app/app.html': NG_HTML,
        'src/app/app.routes.ts':
          'const computed = getRoutes();\nexport const routes: Routes = computed;\n',
      });
      const plan = await planFile(PLAN);

      expect(
        await runCli(['init', '--plan', plan], context(undefined, STRUCTURAL)),
      ).toBe(0);

      expect(out.join('\n')).toContain(
        "  { path: '', pathMatch: 'full', redirectTo: '/products' },",
      );
    });

    it('prints how to open the first page in an app that already has its own', async () => {
      const routesBefore = `import { Routes } from '@angular/router';

import { SignInPage } from './sign-in-page';

export const routes: Routes = [
  { path: 'sign-in', component: SignInPage },
];
`;
      await put({
        'src/app/app.html': NG_HTML,
        'src/app/app.routes.ts': routesBefore,
      });
      const plan = await planFile(PLAN);

      expect(
        await runCli(['init', '--plan', plan], context(undefined, STRUCTURAL)),
      ).toBe(0);

      const routes = await readFile(
        join(root, 'src/app/app.routes.ts'),
        'utf8',
      );
      expect(routes).not.toContain('redirectTo');
      expect(routes).toContain(
        "export const routes: Routes = [\n  ...resourceRoutes,\n  { path: 'sign-in', component: SignInPage },\n];",
      );
      expect(output()).toContain(
        'The app already has its own pages and routes, so pidrang only added the resource routes to src/app/app.routes.ts.',
      );
      expect(output()).toContain(
        "  { path: '', pathMatch: 'full', redirectTo: '/products' },",
      );
    });

    describe("with a table name that holds a quote, such as o'brien", () => {
      const QUOTED = "redirectTo: '/o\\'brien' }";
      const quotedPlan = {
        ...PLAN,
        tables: [{ table: "o'brien", actions: ['list'] }],
      };

      beforeEach(() => {
        vi.mocked(provider.createSchemaProvider).mockReturnValue({
          listTables: vi.fn().mockResolvedValue(["o'brien"]),
          introspectTable: vi.fn().mockResolvedValue({
            fields: [{ name: 'id', type: 'number', readOnly: true }],
            excludedColumns: [],
            unavailableActions: [],
          }),
        });
      });

      it('escapes it in the redirect it writes into a new app', async () => {
        await put({ 'src/app/app.html': NG_HTML });
        const plan = await planFile(quotedPlan);

        expect(
          await runCli(
            ['init', '--plan', plan],
            context(undefined, STRUCTURAL),
          ),
        ).toBe(0);

        expect(
          await readFile(join(root, 'src/app/app.routes.ts'), 'utf8'),
        ).toContain(QUOTED);
      });

      it('escapes it in the redirect it prints for an app with its own routes', async () => {
        await put({
          'src/app/app.html': NG_HTML,
          'src/app/app.routes.ts':
            "import { Routes } from '@angular/router';\n\nexport const routes: Routes = [\n  { path: 'sign-in', component: SignInPage },\n];\n",
        });
        const plan = await planFile(quotedPlan);

        expect(
          await runCli(
            ['init', '--plan', plan],
            context(undefined, STRUCTURAL),
          ),
        ).toBe(0);

        expect(output()).toContain(QUOTED);
      });

      it('escapes it in the pidrang comment of a new app without TypeScript', async () => {
        await put({ 'src/app/app.html': NG_HTML });
        const plan = await planFile(quotedPlan);

        expect(
          await runCli(
            ['init', '--plan', plan],
            context(undefined, { ...STRUCTURAL, typescript: null }),
          ),
        ).toBe(0);

        expect(
          await readFile(join(root, 'src/app/app.routes.ts'), 'utf8'),
        ).toContain(`// pidrang:   { path: '', pathMatch: 'full', ${QUOTED},`);
      });
    });

    it.each([
      ['with TypeScript', STRUCTURAL],
      ['without TypeScript', { ...STRUCTURAL, typescript: null }],
    ])(
      'proposes no redirect to an app that already opens on its own page, %s',
      async (_, tooling) => {
        await put({
          'src/app/app.html': NG_HTML,
          'src/app/app.routes.ts': `import { Routes } from '@angular/router';

import { HomePage } from './home-page';

export const routes: Routes = [
  { path: '', component: HomePage },
];
`,
        });
        const plan = await planFile(PLAN);

        expect(
          await runCli(['init', '--plan', plan], context(undefined, tooling)),
        ).toBe(0);

        expect(output()).not.toContain('The app already has its own pages');
        expect(output()).not.toContain("redirectTo: '/products'");
      },
    );

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

    it('prints the warnings of the provider reading the plan on stderr', async () => {
      const plan = await planFile(PLAN);
      vi.mocked(provider.connectionFromPlan).mockImplementationOnce(
        async (_connection, _env, warn) => {
          warn?.('OLD_KEY is deprecated, set FAKE_KEY instead.');
          return { key: SECRET };
        },
      );

      expect(await runCli(['init', '--plan', plan], context())).toBe(0);
      expect(err).toEqual(['OLD_KEY is deprecated, set FAKE_KEY instead.']);
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

  describe('the navigation layout', () => {
    const NG_APP = `import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('shop');
}
`;

    function newAppFiles(extra: Record<string, string> = {}) {
      return {
        ...STOCK_FILES,
        'src/app/app.ts': NG_APP,
        'src/app/app.config.ts': NG_CONFIG,
        'src/app/app.routes.ts': NG_ROUTES,
        'src/app/app.html': NG_HTML,
        'src/app/app.spec.ts': NG_SPEC,
        ...extra,
      };
    }

    const STRUCTURAL_CONTEXT = () =>
      context(undefined, {
        ...STRUCTURAL,
        typescript: null,
        layoutUi: 'material',
      });

    it('writes the Material layout into a new app that asks for it', async () => {
      await put(newAppFiles());
      const plan = await planFile({ ...PLAN, layout: 'sidebar' });

      expect(await runCli(['init', '--plan', plan], STRUCTURAL_CONTEXT())).toBe(
        0,
      );

      const layout = await readFile(
        join(root, 'src/app/layout/app-layout.ts'),
        'utf8',
      );
      expect(layout).toContain("selector: 'app-layout'");
      expect(layout).toContain('MatToolbarModule');
      expect(layout).toContain(
        "import { injectSignInUrl } from '../pidrang/index';",
      );
      expect(layout).not.toContain('@pidrang/demo-shared');

      expect(await readFile(join(root, 'src/app/app.html'), 'utf8')).toBe(
        '<app-layout appName="Shop" />\n',
      );
      expect(await readFile(join(root, 'src/app/app.ts'), 'utf8')).toContain(
        '// pidrang:   imports: [AppLayout],',
      );
      expect(
        await readFile(join(root, 'src/app/app.spec.ts'), 'utf8'),
      ).toContain('// pidrang:   TestBed.overrideComponent(App, {');
      const config = await readFile(
        join(root, 'src/app/app.config.ts'),
        'utf8',
      );
      expect(config).toContain(
        "// pidrang:   import { provideSignInPath } from './pidrang/index';",
      );
      expect(config).toContain("// pidrang:   provideSignInPath('/sign-in')");
      expect(output()).not.toContain(
        'add this provider to your src/app/app.config.ts',
      );
      expect(
        await readFile(join(root, 'src/app/app.routes.ts'), 'utf8'),
      ).toContain(
        "// pidrang:   { path: '', pathMatch: 'full', redirectTo: '/products' },",
      );
    });

    it('wires the layout into the root component and its test with TypeScript', async () => {
      await put(newAppFiles());
      const plan = await planFile({ ...PLAN, layout: 'sidebar' });

      expect(
        await runCli(['init', '--plan', plan], context(undefined, STRUCTURAL)),
      ).toBe(0);

      const after = await snapshot();
      expect(after['src/app/app.html']).toBe('<app-layout appName="Shop" />\n');
      expect(after['src/app/app.ts']).toBe(
        NG_APP.replace(
          "import { RouterOutlet } from '@angular/router';",
          "import { AppLayout } from './layout/app-layout';",
        ).replace('imports: [RouterOutlet]', 'imports: [AppLayout]'),
      );
      expect(after['src/app/app.spec.ts']).toContain(
        'remove: { imports: [AppLayout] },',
      );
      expect(after['src/app/app.spec.ts']).not.toContain('should render title');
      expect(after['src/app/app.config.ts']).toContain(
        "provideSignInPath('/sign-in')",
      );
      expect(after['src/app/app.config.ts']).toContain(
        "import { provideSignInPath } from './pidrang/index';",
      );
      expect(after['src/app/app.routes.ts']).toContain(
        "{ path: '', pathMatch: 'full', redirectTo: '/products' },",
      );
      expect(after['src/app/layout/app-layout.ts']).toContain(
        "import { injectSignInUrl } from '../pidrang/index';",
      );
      expect(after['src/app/pidrang/index.ts']).toContain(
        "export * from './sign-in-url';",
      );
      expect(output()).toContain(
        "open /sign-in, set by provideSignInPath('/sign-in') in src/app/app.config.ts. The app has no page there yet",
      );
    });

    it('skips the layout and says so when the root component file is missing', async () => {
      const files: Record<string, string> = newAppFiles();
      delete files['src/app/app.ts'];
      await put(files);
      const plan = await planFile({ ...PLAN, layout: 'sidebar' });

      expect(await runCli(['init', '--plan', plan], STRUCTURAL_CONTEXT())).toBe(
        0,
      );

      const after = await snapshot();
      expect(err).toContain(
        'src/app/app.ts was not found, so pidrang did not add the navigation layout.',
      );
      expect(after['src/app/layout/app-layout.ts']).toBeUndefined();
      expect(after['src/app/app.html']).toBe('<router-outlet />\n');
    });

    it('writes the Tailwind layout when the app depends on @pidrang/tailwind', async () => {
      await put(
        newAppFiles({
          'package.json': JSON.stringify({
            dependencies: {
              '@angular/core': '^22.1.0',
              '@pidrang/tailwind': '^0.1.0',
            },
          }),
        }),
      );
      const plan = await planFile({ ...PLAN, layout: 'sidebar' });

      expect(
        await runCli(
          ['init', '--plan', plan],
          context(undefined, {
            ...STRUCTURAL,
            typescript: null,
            layoutUi: 'tailwind',
          }),
        ),
      ).toBe(0);

      const layout = await readFile(
        join(root, 'src/app/layout/app-layout.ts'),
        'utf8',
      );
      expect(layout).toContain('flex min-h-svh');
      expect(layout).not.toContain('MatToolbarModule');
    });

    it('leaves the welcome page alone when the plan asks for no layout', async () => {
      await put(newAppFiles());
      const before = await snapshot();
      const plan = await planFile(PLAN);

      expect(await runCli(['init', '--plan', plan], STRUCTURAL_CONTEXT())).toBe(
        0,
      );

      const after = await snapshot();
      expect(after['src/app/layout/app-layout.ts']).toBeUndefined();
      expect(after['src/app/app.html']).toBe('<router-outlet />\n');
      expect(before['src/app/app.html']).toBe(NG_HTML);
      expect(after['src/app/app.config.ts']).not.toContain('provideSignInPath');
    });

    it('leaves the layout alone in an app that already has its own pages', async () => {
      await put({
        ...newAppFiles(),
        'src/app/app.routes.ts': `import { Routes } from '@angular/router';

import { SignInPage } from './sign-in-page';

export const routes: Routes = [
  { path: 'sign-in', component: SignInPage },
];
`,
      });
      const plan = await planFile({ ...PLAN, layout: 'sidebar' });

      expect(await runCli(['init', '--plan', plan], STRUCTURAL_CONTEXT())).toBe(
        0,
      );

      const after = await snapshot();
      expect(after['src/app/layout/app-layout.ts']).toBeUndefined();
      expect(after['src/app/app.html']).toBe('<router-outlet />\n');
      expect(after['src/app/app.config.ts']).not.toContain('provideSignInPath');
    });

    it('stops before writing when the layout file is already there', async () => {
      await put(newAppFiles({ 'src/app/layout/app-layout.ts': '// mine\n' }));
      const plan = await planFile({ ...PLAN, layout: 'sidebar' });

      expect(await runCli(['init', '--plan', plan], STRUCTURAL_CONTEXT())).toBe(
        1,
      );

      const after = await snapshot();
      expect(err.join('\n')).toContain('src/app/layout/app-layout.ts');
      expect(after['src/app/layout/app-layout.ts']).toBe('// mine\n');
      expect(after['src/app/resources.ts']).toBeUndefined();
      expect(after['src/app/app.html']).toBe(NG_HTML);
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

  describe('the package install', () => {
    const MANUAL = [
      'Install the packages manually, then run ng build:',
      '  npm install @pidrang/core@9.8.7 @pidrang/fake@9.8.7 fake-client @pidrang/material@9.8.7',
      '  npx ng add @angular/material',
    ];

    it('refuses an unsupported Node.js before anything else', async () => {
      const before = await snapshot();

      expect(
        await runCli(['init'], { ...context(), nodeVersion: '20.19.0' }),
      ).toBe(1);

      expect(err).toEqual([
        'pidrang needs Node.js 22.22.3 or a later 22.x, 24.15.0 or a later 24.x, or 26 and later; this is Node.js 20.19.0. Install a supported Node.js version and run pidrang init again.',
        'Nothing was written.',
      ]);
      expect(provider.promptConnection).not.toHaveBeenCalled();
      expect(await snapshot()).toEqual(before);
    });

    it('installs with npm, @pidrang packages pinned to the CLI version, then adds Angular Material', async () => {
      expect(await runCli(['init'], context())).toBe(0);

      expect(confirmInstall).toHaveBeenCalledTimes(1);
      expect(runCommand.mock.calls).toEqual([
        [
          {
            command: 'npm',
            args: [
              'install',
              '@pidrang/core@9.8.7',
              '@pidrang/fake@9.8.7',
              'fake-client',
              '@pidrang/material@9.8.7',
            ],
          },
        ],
        [{ command: 'npx', args: ['ng', 'add', '@angular/material'] }],
      ]);
      expect(out.indexOf('Running npx ng add @angular/material')).toBeLessThan(
        out.indexOf('Installed the packages. Run ng build to check the app.'),
      );
      expect(output()).not.toContain('Install the packages manually');
      expect(err).toEqual([]);
    });

    it.each([
      ['pnpm-lock.yaml', 'pnpm', ['add'], 'pnpm', ['exec', 'ng']],
      ['yarn.lock', 'yarn', ['add'], 'yarn', ['ng']],
      ['package-lock.json', 'npm', ['install'], 'npx', ['ng']],
    ])(
      'uses the package manager of %s',
      async (lockfile, manager, install, runner, ng) => {
        await put({ [lockfile]: '' });

        expect(await runCli(['init'], context())).toBe(0);

        const [first] = runCommand.mock.calls[0];
        expect(first.command).toBe(manager);
        expect(first.args.slice(0, install.length + 1)).toEqual([
          ...install,
          '@pidrang/core@9.8.7',
        ]);
        expect(runCommand.mock.calls[1][0]).toEqual({
          command: runner,
          args: [...ng, 'add', '@angular/material'],
        });
      },
    );

    it('prints the commands and succeeds when the answer is no', async () => {
      confirmInstall.mockResolvedValueOnce(false);

      expect(await runCli(['init'], context())).toBe(0);

      expect(runCommand).not.toHaveBeenCalled();
      expect(out.slice(-MANUAL.length)).toEqual(MANUAL);
    });

    it('stops at the first failing command, keeps the files and prints the commands', async () => {
      runCommand.mockResolvedValueOnce(false);

      expect(await runCli(['init'], context())).toBe(1);

      expect(runCommand).toHaveBeenCalledTimes(1);
      expect(err).toContain(
        'npm install @pidrang/core@9.8.7 @pidrang/fake@9.8.7 fake-client @pidrang/material@9.8.7 failed: see its output above.',
      );
      expect(out.slice(-MANUAL.length)).toEqual(MANUAL);
      expect(await listFiles()).toEqual(
        expect.arrayContaining(['src/app/resources.ts']),
      );
    });

    it('exits with 130 and prints the commands when the question is cancelled', async () => {
      const cancelled = new Error('User force closed the prompt with SIGINT');
      cancelled.name = 'ExitPromptError';
      confirmInstall.mockRejectedValueOnce(cancelled);

      expect(await runCli(['init'], context())).toBe(130);

      expect(runCommand).not.toHaveBeenCalled();
      expect(out.slice(-MANUAL.length)).toEqual(MANUAL);
      expect(output()).not.toContain('nothing was written');
    });

    it.each([
      [['init', '--skip-install']],
      [['init', '--plan', 'plan.json']],
      [['init', '--plan', 'plan.json', '--skip-install']],
    ])('asks nothing and prints the commands for %j', async (argv) => {
      await planFile(PLAN);

      expect(await runCli(argv, context())).toBe(0);

      expect(confirmInstall).not.toHaveBeenCalled();
      expect(runCommand).not.toHaveBeenCalled();
      expect(out.slice(-MANUAL.length)).toEqual(MANUAL);
    });

    async function installed(versions: Record<string, string>): Promise<void> {
      await put({
        'package.json': JSON.stringify({
          dependencies: {
            '@angular/core': '^22.1.0',
            ...Object.fromEntries(
              Object.keys(versions).map((name) => [name, '*']),
            ),
          },
        }),
        ...Object.fromEntries(
          Object.entries(versions).map(([name, version]) => [
            `node_modules/${name}/package.json`,
            JSON.stringify({ version }),
          ]),
        ),
      });
    }

    const EVERY_PACKAGE = {
      '@pidrang/core': '9.8.7',
      '@pidrang/fake': '9.8.7',
      'fake-client': '1.0.0',
      '@pidrang/material': '9.8.7',
      '@angular/material': '22.2.4',
    };

    it('asks nothing when every package is already there at the expected version', async () => {
      await installed(EVERY_PACKAGE);

      expect(await runCli(['init'], context())).toBe(0);

      expect(confirmInstall).not.toHaveBeenCalled();
      expect(runCommand).not.toHaveBeenCalled();
      expect(out.at(-1)).toBe('The required packages are already installed.');
    });

    it('installs only what is missing or at another version, and leaves Material alone when it is there', async () => {
      await installed({
        ...EVERY_PACKAGE,
        '@pidrang/core': '9.8.6',
        'fake-client': '1.0.0',
      });
      await rm(join(root, 'node_modules/fake-client'), { recursive: true });

      expect(await runCli(['init'], context())).toBe(0);

      expect(runCommand.mock.calls).toEqual([
        [
          {
            command: 'npm',
            args: ['install', '@pidrang/core@9.8.7', 'fake-client'],
          },
        ],
      ]);
    });

    it('prints only the missing commands', async () => {
      await installed({ ...EVERY_PACKAGE, '@angular/material': '' });
      await rm(join(root, 'node_modules/@angular/material'), {
        recursive: true,
      });

      expect(await runCli(['init', '--skip-install'], context())).toBe(0);

      expect(out.slice(-2)).toEqual([
        'Install the packages manually, then run ng build:',
        '  npx ng add @angular/material',
      ]);
    });

    it('runs nothing with a package manager it cannot run and prints the npm commands', async () => {
      await put({
        'angular.json': JSON.stringify({
          cli: { packageManager: 'cnpm' },
          projects: { shop: { projectType: 'application', sourceRoot: 'src' } },
        }),
      });

      expect(await runCli(['init'], context())).toBe(0);

      expect(confirmInstall).not.toHaveBeenCalled();
      expect(runCommand).not.toHaveBeenCalled();
      expect(out.slice(-MANUAL.length)).toEqual([
        'pidrang cannot run cnpm, the package manager this app names. Install the packages with it, then run ng build. With npm, the commands would be:',
        ...MANUAL.slice(1),
      ]);
    });

    it('exits with 130 and prints what is left when interrupted during the install', async () => {
      const controller = new AbortController();
      interruptSignal = controller.signal;
      runCommand.mockImplementation(async (command) => {
        if (command.command === 'npx') {
          controller.abort();
          return false;
        }
        return true;
      });

      expect(await runCli(['init'], context())).toBe(130);

      expect(runCommand).toHaveBeenCalledTimes(2);
      expect(out.slice(-2)).toEqual([
        'Install the packages manually, then run ng build:',
        '  npx ng add @angular/material',
      ]);
      expect(output()).not.toContain('failed: see its output above');
    });
  });
});
