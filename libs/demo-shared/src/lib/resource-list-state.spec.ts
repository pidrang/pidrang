import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AuthIdentity,
  AuthProvider,
  DataProvider,
  ListParams,
  Resource,
  providePidrang,
} from '@pidrang/core';

import { injectResourceListState } from './resource-list-state';

function setUp(resources: Resource[], authProvider?: AuthProvider) {
  const requests: { resource: string; params: ListParams | undefined }[] = [];
  const dataProvider: DataProvider = {
    getList: <T>(resource: string, params?: ListParams) => {
      requests.push({ resource, params });
      return Promise.resolve({ data: [] as T[], total: 0 });
    },
    getOne: () => Promise.reject(new Error('unused')),
    create: () => Promise.reject(new Error('unused')),
    update: () => Promise.reject(new Error('unused')),
    delete: () => Promise.reject(new Error('unused')),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      providePidrang({
        dataProvider,
        resources,
        ...(authProvider === undefined ? {} : { authProvider }),
      }),
    ],
  });
  return requests;
}

const newestFirst: ListParams['sorters'] = [
  { field: 'created_at', order: 'desc' },
  { field: 'id', order: 'asc' },
];

describe('injectResourceListState', () => {
  it('sorts by the default sorters the resource declares', async () => {
    const requests = setUp([{ name: 'products', defaultSorters: newestFirst }]);
    TestBed.runInInjectionContext(() =>
      injectResourceListState(signal('products')),
    );

    TestBed.tick();
    await Promise.resolve();

    expect(requests.map((request) => request.params?.sorters)).toEqual([
      newestFirst,
    ]);
  });

  it('sorts by id when the resource declares no default sorters', async () => {
    const requests = setUp([{ name: 'products' }]);
    TestBed.runInInjectionContext(() =>
      injectResourceListState(signal('products')),
    );

    TestBed.tick();
    await Promise.resolve();

    expect(requests.map((request) => request.params?.sorters)).toEqual([
      [{ field: 'id', order: 'asc' }],
    ]);
  });

  it('sorts by id for a resource missing from the list of resources', async () => {
    const requests = setUp([{ name: 'products', defaultSorters: newestFirst }]);
    TestBed.runInInjectionContext(() =>
      injectResourceListState(signal('unknown')),
    );

    TestBed.tick();
    await Promise.resolve();

    expect(requests.map((request) => request.params?.sorters)).toEqual([
      [{ field: 'id', order: 'asc' }],
    ]);
  });

  it('switches sorters when the page moves to a resource with other defaults', async () => {
    const requests = setUp([
      { name: 'products', defaultSorters: newestFirst },
      { name: 'tags' },
    ]);
    const resource = signal('products');
    TestBed.runInInjectionContext(() => injectResourceListState(resource));
    TestBed.tick();
    await Promise.resolve();

    resource.set('tags');
    TestBed.tick();
    await Promise.resolve();

    expect(requests.map((request) => request.resource)).toEqual([
      'products',
      'tags',
    ]);
    expect(requests.map((request) => request.params?.sorters)).toEqual([
      newestFirst,
      [{ field: 'id', order: 'asc' }],
    ]);
  });
});

function identityProvider(
  getIdentity: () => Promise<AuthIdentity | null>,
): AuthProvider {
  return {
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    getIdentity,
  };
}

function controlledIdentity(initial: AuthIdentity | null): {
  provider: AuthProvider;
  setIdentity(identity: AuthIdentity | null): void;
} {
  let identity = initial;
  const listeners = new Set<() => void>();
  return {
    provider: {
      ...identityProvider(() => Promise.resolve(identity)),
      onSessionChange: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    setIdentity: (next) => {
      identity = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

async function settle(): Promise<void> {
  for (let pass = 0; pass < 3; pass += 1) {
    TestBed.tick();
    await Promise.resolve();
  }
}

function listState(authProvider?: AuthProvider) {
  setUp([{ name: 'products' }], authProvider);
  return TestBed.runInInjectionContext(() =>
    injectResourceListState(signal('products')),
  );
}

describe('injectResourceListState and the session', () => {
  it('keeps every action for a signed-in user', async () => {
    const state = listState(
      identityProvider(() => Promise.resolve({ id: 'writer' })),
    );
    await settle();

    expect([
      state.canCreate(),
      state.canShow(),
      state.canEdit(),
      state.canDelete(),
    ]).toEqual([true, true, true, true]);
  });

  it('hides the write actions but keeps show when nobody is signed in', async () => {
    const state = listState(identityProvider(() => Promise.resolve(null)));
    await settle();

    expect(state.canCreate()).toBe(false);
    expect(state.canShow()).toBe(true);
    expect(state.canEdit()).toBe(false);
    expect(state.canDelete()).toBe(false);
  });

  it('hides the write actions while the session is being read', async () => {
    const state = listState(
      identityProvider(() => new Promise(() => undefined)),
    );
    await settle();

    expect(state.canCreate()).toBe(false);
    expect(state.canShow()).toBe(true);
    expect(state.canEdit()).toBe(false);
    expect(state.canDelete()).toBe(false);
  });

  it('keeps every action without an auth provider', async () => {
    const state = listState();
    await settle();

    expect([
      state.canCreate(),
      state.canShow(),
      state.canEdit(),
      state.canDelete(),
    ]).toEqual([true, true, true, true]);
  });

  it('brings the write actions back when the session changes', async () => {
    const auth = controlledIdentity(null);
    const state = listState(auth.provider);
    await settle();
    expect(state.canCreate()).toBe(false);

    auth.setIdentity({ id: 'writer' });
    await settle();

    expect(state.canCreate()).toBe(true);
    expect(state.canEdit()).toBe(true);
    expect(state.canDelete()).toBe(true);
  });
});
