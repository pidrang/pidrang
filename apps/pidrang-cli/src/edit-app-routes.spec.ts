import * as typescript from 'typescript';
import { editAppRoutes } from './edit-app-routes';

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
