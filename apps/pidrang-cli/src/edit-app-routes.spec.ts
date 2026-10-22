import * as typescript from 'typescript';
import { editAppRoutes, isNewApp } from './edit-app-routes';

const edit = (source: string) =>
  editAppRoutes(
    typescript,
    'src/app/app.routes.ts',
    source,
    './resource-routes',
  );

const edited = (source: string) => {
  const result = edit(source);
  if (result.kind !== 'edited') {
    throw new Error(`expected an edit, got ${result.kind}`);
  }
  return result.content;
};

describe('editAppRoutes', () => {
  it('adds the import and the spread to an empty routes array', () => {
    expect(
      edited(`import { Routes } from '@angular/router';

export const routes: Routes = [];
`),
    ).toBe(`import { Routes } from '@angular/router';
import { resourceRoutes } from './resource-routes';

export const routes: Routes = [
  ...resourceRoutes,
];
`);
  });

  it('puts the spread before the routes the app already declares', () => {
    const result = edited(`import { Routes } from '@angular/router';

import { SignInPage } from './sign-in-page';

export const routes: Routes = [
  { path: 'sign-in', component: SignInPage },
  { path: '**', redirectTo: '' },
];
`);

    expect(result).toContain(
      "export const routes: Routes = [\n  ...resourceRoutes,\n  { path: 'sign-in'",
    );
    expect(result.indexOf('...resourceRoutes')).toBeLessThan(
      result.indexOf("path: '**'"),
    );
  });

  it('redirects the empty path to the resource page when asked', () => {
    const result = editAppRoutes(
      typescript,
      'src/app/app.routes.ts',
      `import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'sign-in', component: SignInPage },
];
`,
      './resource-routes',
      'products',
    );

    expect(result).toEqual({
      kind: 'edited',
      content: `import { Routes } from '@angular/router';
import { resourceRoutes } from './resource-routes';

export const routes: Routes = [
  ...resourceRoutes,
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  { path: 'sign-in', component: SignInPage },
];
`,
    });
  });

  it('redirects the empty path of an empty routes array', () => {
    expect(
      editAppRoutes(
        typescript,
        'src/app/app.routes.ts',
        `export const routes: Routes = [];
`,
        './resource-routes',
        'products/create',
      ),
    ).toEqual({
      kind: 'edited',
      content: `import { resourceRoutes } from './resource-routes';
export const routes: Routes = [
  ...resourceRoutes,
  { path: '', pathMatch: 'full', redirectTo: 'products/create' },
];
`,
    });
  });

  it.each([
    ["{ path: '', redirectTo: 'login', pathMatch: 'full' }"],
    ['{ path: "", component: HomePage }'],
  ])(
    'keeps a routes array that already declares the empty path (%s)',
    (route) => {
      const result = editAppRoutes(
        typescript,
        'src/app/app.routes.ts',
        `export const routes: Routes = [
  ${route},
];
`,
        './resource-routes',
        'products',
      );

      expect(result).toEqual({
        kind: 'edited',
        content: `import { resourceRoutes } from './resource-routes';
export const routes: Routes = [
  ...resourceRoutes,
  ${route},
];
`,
      });
    },
  );

  it('lists the redirect to add by hand when it cannot edit the routes', () => {
    const result = editAppRoutes(
      null,
      'src/app/app.routes.ts',
      `export const routes: Routes = [];
`,
      './resource-routes',
      'products',
    );

    expect(result.kind).toBe('manual');
    if (result.kind === 'manual') {
      expect(result.content).toContain(
        `{ path: '', pathMatch: 'full', redirectTo: 'products' },`,
      );
    }
  });

  it('leaves a file that already spreads the resource routes alone', () => {
    const source = edited(`export const routes: Routes = [];
`);

    expect(edit(source)).toEqual({ kind: 'unchanged' });
  });

  it('leaves a file that already calls resourceRoutes alone', () => {
    expect(
      edit(`import { resourceRoutes } from './resource-routes';

export const routes: Routes = [...resourceRoutes];
`),
    ).toEqual({ kind: 'unchanged' });
  });

  it.each([
    [
      'a routes array built at run time',
      `const computed = getRoutes();
export const routes: Routes = computed;
`,
    ],
    [
      'no routes declaration',
      `export const appRoutes: Routes = [];
`,
    ],
    [
      'a name already used for something else',
      `import { resourceRoutes } from './other';

export const routes: Routes = [];
`,
    ],
  ])('writes a comment for %s', (_, source) => {
    const result = edit(source);

    expect(result.kind).toBe('manual');
    if (result.kind !== 'manual') {
      return;
    }
    expect(result.content.startsWith('// pidrang:')).toBe(true);
    expect(result.content).toContain(
      "import { resourceRoutes } from './resource-routes';",
    );
    expect(result.content.endsWith(source)).toBe(true);
    expect(edit(result.content)).toEqual({ kind: 'unchanged' });
  });

  it('ignores a declaration that is not named routes', () => {
    const result = edit(`export const routes: Routes = [];
export const routes2: Routes = [];
`);

    expect(result.kind).toBe('edited');
  });

  describe('isNewApp', () => {
    const WELCOME = `<div class="welcome">
  <p>Congratulations! Your app is running.</p>
</div>
<router-outlet />`;

    it('recognizes the welcome page of ng new with an empty routes array', () => {
      expect(
        isNewApp(
          typescript,
          'export const routes: Routes = [];\n',
          WELCOME,
          WELCOME,
        ),
      ).toBe(true);
    });

    it.each([
      [
        'the app has routes',
        'export const routes = [{ path: "sign-in" }];\n',
        WELCOME,
      ],
      [
        'the app has routes without the welcome template',
        "export const routes = [\n  { path: 'sign-in', component: SignInPage },\n];\n",
        null,
      ],
      [
        'app.html is customized',
        'export const routes = [];\n',
        '<main><router-outlet /></main>\n',
      ],
      [
        'app.html holds nothing but the outlet',
        'export const routes = [];\n',
        '<router-outlet />\n',
      ],
      ['app.html is missing', 'export const routes = [];\n', null],
      [
        'the routes are not an array literal',
        'export const routes = getRoutes();\n',
        WELCOME,
      ],
    ])('returns false when %s', (_, routes, html) => {
      expect(isNewApp(typescript, routes, html, WELCOME)).toBe(false);
    });

    it('recognizes an empty routes array without TypeScript', () => {
      expect(
        isNewApp(null, 'export const routes = [];\n', WELCOME, WELCOME),
      ).toBe(true);
      expect(
        isNewApp(
          null,
          'export const routes = [{ path: "a" }];\n',
          WELCOME,
          WELCOME,
        ),
      ).toBe(false);
    });
  });

  it('writes a comment when TypeScript is not installed', () => {
    const result = editAppRoutes(
      null,
      'src/app/app.routes.ts',
      'export const routes: Routes = [];\n',
      './resource-routes',
    );

    expect(result).toMatchObject({
      kind: 'manual',
      reason: 'TypeScript is not installed in this app',
    });
  });
});
