import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  UnsupportedAppError,
  findTakenRoutes,
  preflightApp,
} from './preflight-app';

const STOCK_FILES: Record<string, string> = {
  'angular.json': JSON.stringify({
    projects: {
      shop: { projectType: 'application', root: '', sourceRoot: 'src' },
    },
  }),
  'package.json': JSON.stringify({
    dependencies: { '@angular/core': '^22.1.0' },
  }),
  'src/app/app.config.ts': 'export const appConfig = { providers: [] };',
  'src/app/app.routes.ts': 'export const routes: Routes = [];',
};

describe('preflightApp', () => {
  let root: string;

  async function write(files: Record<string, string | null>): Promise<void> {
    for (const [path, content] of Object.entries({
      ...STOCK_FILES,
      ...files,
    })) {
      if (content === null) {
        continue;
      }
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), content, 'utf8');
    }
  }

  async function problemsOf(project?: string): Promise<string[]> {
    const error = await preflightApp(root, project).then(
      () => null,
      (err: unknown) => err,
    );
    if (!(error instanceof UnsupportedAppError)) {
      throw new Error(`expected an UnsupportedAppError, got ${String(error)}`);
    }
    return error.problems;
  }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pidrang-preflight-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('recognizes a stock standalone app', async () => {
    await write({});

    expect(await preflightApp(root)).toEqual({
      project: 'shop',
      sourceRoot: 'src',
      appDirectory: 'src/app',
      routesFile: 'src/app/app.routes.ts',
      configFile: 'src/app/app.config.ts',
      takenRoutes: [],
      bindsComponentInputs: false,
    });
  });

  it('sees whether the router already binds component inputs', async () => {
    await write({
      'src/app/app.config.ts':
        'provideRouter(routes, withComponentInputBinding())',
    });

    expect(await preflightApp(root)).toMatchObject({
      bindsComponentInputs: true,
    });
  });

  it('collects the routes the app already declares', async () => {
    await write({
      'src/app/app.routes.ts': "export const routes = [{ path: 'login' }];",
    });

    expect((await preflightApp(root)).takenRoutes).toEqual(['login']);
  });

  it('follows the sourceRoot of the application', async () => {
    await write({
      'angular.json': JSON.stringify({
        projects: {
          admin: {
            projectType: 'application',
            root: 'projects/admin',
            sourceRoot: 'projects/admin/src',
          },
        },
      }),
      'src/app/app.config.ts': null,
      'src/app/app.routes.ts': null,
      'projects/admin/src/app/app.config.ts': '',
      'projects/admin/src/app/app.routes.ts': '',
    });

    expect(await preflightApp(root)).toMatchObject({
      project: 'admin',
      appDirectory: 'projects/admin/src/app',
      configFile: 'projects/admin/src/app/app.config.ts',
    });
  });

  it('uses root/src when the application has no sourceRoot', async () => {
    await write({
      'angular.json': JSON.stringify({
        projects: { admin: { projectType: 'application', root: 'admin' } },
      }),
      'admin/src/app/app.config.ts': '',
      'admin/src/app/app.routes.ts': '',
    });

    expect((await preflightApp(root)).appDirectory).toBe('admin/src/app');
  });

  it('refuses a sourceRoot outside the workspace', async () => {
    await write({
      'angular.json': JSON.stringify({
        projects: {
          shop: { projectType: 'application', sourceRoot: '../elsewhere/src' },
        },
      }),
    });

    expect(await problemsOf()).toEqual([
      'the sourceRoot of "shop" points outside the workspace',
    ]);
  });

  it('refuses a folder without angular.json', async () => {
    expect(await problemsOf()).toEqual([
      'there is no angular.json here: run pidrang init from the root of your Angular workspace',
    ]);
  });

  it('refuses an angular.json that is not JSON', async () => {
    await write({ 'angular.json': '{' });

    expect(await problemsOf()).toEqual(['angular.json is not valid JSON']);
  });

  it('refuses a workspace with only libraries', async () => {
    await write({
      'angular.json': JSON.stringify({
        projects: { ui: { projectType: 'library', root: 'ui' } },
      }),
    });

    expect(await problemsOf()).toEqual([
      'angular.json declares no application',
    ]);
  });

  describe('with several applications', () => {
    beforeEach(async () => {
      await write({
        'angular.json': JSON.stringify({
          projects: {
            shop: { projectType: 'application', sourceRoot: 'src' },
            admin: { projectType: 'application', sourceRoot: 'admin/src' },
            ui: { projectType: 'library', sourceRoot: 'ui/src' },
          },
        }),
      });
    });

    it('asks for --project', async () => {
      expect(await problemsOf()).toEqual([
        'angular.json declares several applications (shop, admin): choose one with --project <name>',
      ]);
    });

    it('uses the one --project names', async () => {
      expect((await preflightApp(root, 'shop')).appDirectory).toBe('src/app');
    });

    it.each(['blog', 'ui'])('refuses --project %s', async (project) => {
      expect(await problemsOf(project)).toEqual([
        `angular.json has no application named "${project}" (applications: shop, admin)`,
      ]);
    });
  });

  it.each([['^22.1.0'], ['~22.3.2'], ['22.1.0'], ['>=22.1.0 <23.0.0']])(
    'accepts a declared @angular/core %s',
    async (range) => {
      await write({
        'package.json': JSON.stringify({
          dependencies: { '@angular/core': range },
        }),
      });

      await expect(preflightApp(root)).resolves.toBeDefined();
    },
  );

  it('accepts @angular/core declared as a dev dependency', async () => {
    await write({
      'package.json': JSON.stringify({
        devDependencies: { '@angular/core': '^22.1.0' },
      }),
    });

    await expect(preflightApp(root)).resolves.toBeDefined();
  });

  it.each([['^22.0.0'], ['^21.2.0'], ['^23.0.0'], ['latest']])(
    'refuses a declared @angular/core %s',
    async (range) => {
      await write({
        'package.json': JSON.stringify({
          dependencies: { '@angular/core': range },
        }),
      });

      expect(await problemsOf()).toEqual([
        `package.json asks for @angular/core ${range}, pidrang needs Angular 22.1 or a later 22.x`,
      ]);
    },
  );

  it('trusts the installed @angular/core over the declared range', async () => {
    await write({
      'package.json': JSON.stringify({
        dependencies: { '@angular/core': '^22.0.0' },
      }),
      'node_modules/@angular/core/package.json': JSON.stringify({
        version: '22.2.1',
      }),
    });
    await expect(preflightApp(root)).resolves.toBeDefined();

    await write({
      'node_modules/@angular/core/package.json': JSON.stringify({
        version: '22.0.4',
      }),
    });
    expect(await problemsOf()).toEqual([
      'the installed @angular/core is 22.0.4, pidrang needs Angular 22.1 or a later 22.x',
    ]);
  });

  it('refuses a workspace without @angular/core or without package.json', async () => {
    await write({ 'package.json': JSON.stringify({ dependencies: {} }) });
    expect(await problemsOf()).toEqual([
      'package.json does not depend on @angular/core',
    ]);

    await rm(join(root, 'package.json'));
    expect(await problemsOf()).toEqual([
      'there is no readable package.json next to angular.json',
    ]);
  });

  it('names every missing piece of the layout at once', async () => {
    await write({
      'package.json': JSON.stringify({
        dependencies: { '@angular/core': '^21.0.0' },
      }),
      'src/app/app.config.ts': null,
      'src/app/app.routes.ts': null,
    });

    expect(await problemsOf()).toEqual([
      'package.json asks for @angular/core ^21.0.0, pidrang needs Angular 22.1 or a later 22.x',
      'src/app/app.config.ts is missing: pidrang supports a standalone app laid out like ng new creates it',
      'src/app/app.routes.ts is missing: create the app with routing, or add that file with export const routes: Routes = []',
    ]);
  });
});

describe('findTakenRoutes', () => {
  it('keeps the first static segment of every route path', () => {
    expect(
      findTakenRoutes(`
        export const routes: Routes = [
          { path: '', component: Home },
          { path: 'login', component: Login },
          { path: "auth/sign-in", component: SignIn },
          { path: \`settings\`, component: Settings },
          { path:'login', redirectTo: '' },
          { path: ':resource', component: List },
          { path: '**', component: NotFound },
          { path: \`\${prefix}/x\`, component: Dynamic },
          { path: RESOURCE_UNAVAILABLE_PATH, component: Unavailable },
        ];
      `),
    ).toEqual(['login', 'auth', 'settings']);
  });
});
