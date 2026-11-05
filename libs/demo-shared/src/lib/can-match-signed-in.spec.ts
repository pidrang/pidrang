import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  GuardResult,
  PartialMatchRouteSnapshot,
  RedirectCommand,
  Route,
  Routes,
  Router,
  UrlSegment,
  provideRouter,
} from '@angular/router';
import {
  AuthIdentity,
  AuthProvider,
  DataProvider,
  providePidrang,
} from '@pidrang/core';

import { canMatchSignedIn } from './can-match-signed-in';
import { injectSignedInResources } from './inject-signed-in-resources';
import { provideSignInPath } from './provide-sign-in-path';

const dataProvider: DataProvider = {
  getList: () => Promise.reject(new Error('unused')),
  getOne: () => Promise.reject(new Error('unused')),
  create: () => Promise.reject(new Error('unused')),
  update: () => Promise.reject(new Error('unused')),
  delete: () => Promise.reject(new Error('unused')),
};

interface Setup {
  signedIn?: AuthIdentity | null;
  rejects?: boolean;
  signInPath?: string | null;
  auth?: boolean;
}

async function matches(
  resources: string[],
  path: string,
  setup: Setup = {},
): Promise<boolean | string> {
  const authProvider: AuthProvider = {
    login: () => Promise.reject(new Error('unused')),
    logout: () => Promise.reject(new Error('unused')),
    getIdentity: () =>
      setup.rejects === true
        ? Promise.reject(new Error('unreachable'))
        : Promise.resolve(setup.signedIn ?? null),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      ...(setup.signInPath === null
        ? []
        : [provideSignInPath(setup.signInPath ?? '/sign-in')]),
      providePidrang({
        dataProvider,
        resources: [],
        ...(setup.auth === false ? {} : { authProvider }),
      }),
    ],
  });
  const result: GuardResult = await TestBed.runInInjectionContext(
    () =>
      canMatchSignedIn(resources)(
        {} as Route,
        [{ path }] as UrlSegment[],
        {} as PartialMatchRouteSnapshot,
      ) as Promise<GuardResult>,
  );
  if (!(result instanceof RedirectCommand)) {
    return result as boolean;
  }
  return TestBed.inject(Router).serializeUrl(
    result.redirectTo as Parameters<Router['serializeUrl']>[0],
  );
}

describe('canMatchSignedIn', () => {
  it('lets a signed-out visitor through a resource that is not listed', async () => {
    expect(await matches(['orders'], 'products')).toBe(true);
  });

  it('lets a signed-out visitor through every resource when no sign-in path is given', async () => {
    expect(await matches(['orders'], 'orders', { signInPath: null })).toBe(
      true,
    );
  });

  it('lets a signed-out visitor through when the app has no auth provider', async () => {
    expect(await matches(['orders'], 'orders', { auth: false })).toBe(true);
  });

  it('sends a signed-out visitor of a listed resource to the sign-in page', async () => {
    expect(await matches(['orders'], 'orders')).toBe('/sign-in');
  });

  it('keeps the query string of the sign-in path', async () => {
    expect(
      await matches(['orders'], 'orders', { signInPath: '/auth?mode=signin' }),
    ).toBe('/auth?mode=signin');
  });

  it('lets a signed-in visitor through', async () => {
    expect(
      await matches(['orders'], 'orders', { signedIn: { id: 'writer' } }),
    ).toBe(true);
  });

  it('lets the visitor through when the identity cannot be read', async () => {
    expect(await matches(['orders'], 'orders', { rejects: true })).toBe(true);
  });
});

@Component({ template: '' })
class EmptyPage {}

describe('injectSignedInResources', () => {
  function guardedNames(routes: Routes): ReadonlySet<string> {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    return TestBed.runInInjectionContext(() => injectSignedInResources());
  }

  it('reads the resources of a guard on a top-level route', () => {
    const names = guardedNames([
      {
        path: 'products',
        canMatch: [canMatchSignedIn(['products', 'orders'])],
        component: EmptyPage,
      },
    ]);

    expect([...names]).toEqual(['products', 'orders']);
  });

  it('reads the resources of a guard on a child route', () => {
    const names = guardedNames([
      {
        path: '',
        children: [
          {
            path: 'secrets',
            canMatch: [canMatchSignedIn(['secrets'])],
            component: EmptyPage,
          },
        ],
      },
    ]);

    expect([...names]).toEqual(['secrets']);
  });

  it('ignores a guard given as a token', () => {
    const names = guardedNames([
      { path: 'products', canMatch: ['someToken'], component: EmptyPage },
    ]);

    expect([...names]).toEqual([]);
  });

  it('ignores a guard that is not built by canMatchSignedIn', () => {
    const names = guardedNames([
      { path: 'products', canMatch: [() => true], component: EmptyPage },
    ]);

    expect([...names]).toEqual([]);
  });

  it('reads nothing without routes', () => {
    expect([...guardedNames([])]).toEqual([]);
  });

  it('unions the resources of two guards', () => {
    const names = guardedNames([
      {
        path: 'products',
        canMatch: [canMatchSignedIn(['products'])],
        component: EmptyPage,
      },
      {
        path: 'orders',
        canMatch: [canMatchSignedIn(['orders', 'users'])],
        component: EmptyPage,
      },
    ]);

    expect([...names]).toEqual(['products', 'orders', 'users']);
  });
});
