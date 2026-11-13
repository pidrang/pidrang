import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AuthIdentity,
  AuthProvider,
  DataProvider,
  ListParams,
  ListResult,
  Resource,
  providePidrang,
} from '@pidrang/core';

import { injectResourceListState } from './resource-list-state';
import { ResourceRow } from './resource-row';

type ListReply = () => Promise<ListResult<ResourceRow>>;

function setUp(
  resources: Resource[],
  authProvider?: AuthProvider,
  reply?: ListReply,
) {
  const requests: { resource: string; params: ListParams | undefined }[] = [];
  const dataProvider: DataProvider = {
    getList: <T>(resource: string, params?: ListParams) => {
      requests.push({ resource, params });
      if (reply === undefined) {
        return Promise.resolve({ data: [] as T[], total: 0 });
      }
      return reply() as Promise<ListResult<T>>;
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

const twoRows: ResourceRow[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];
const newRows: ResourceRow[] = [{ id: '3', name: 'Carol' }];

function reply(data: ResourceRow[], total: number): ListReply {
  return () => Promise.resolve({ data, total });
}

function switchableReply(first: ListReply): {
  reply: ListReply;
  use(next: ListReply): void;
} {
  let current = first;
  return {
    reply: () => current(),
    use: (next) => {
      current = next;
    },
  };
}

function deferredReply(): {
  reply: ListReply;
  resolve(data: ResourceRow[]): void;
  reject(error: Error): void;
} {
  let resolveReply: (value: ListResult<ResourceRow>) => void = () => undefined;
  let rejectReply: (error: Error) => void = () => undefined;
  const pending = new Promise<ListResult<ResourceRow>>((resolve, reject) => {
    resolveReply = resolve;
    rejectReply = reject;
  });
  return {
    reply: () => pending,
    resolve: (data) => resolveReply({ data, total: 100 }),
    reject: (error) => rejectReply(error),
  };
}

describe('injectResourceListState sorting', () => {
  it('sends the chosen sort first, then id', async () => {
    const requests = setUp(
      [{ name: 'products', defaultSorters: newestFirst }],
      undefined,
      reply([], 100),
    );
    const state = TestBed.runInInjectionContext(() =>
      injectResourceListState(signal('products')),
    );
    await settle();

    state.sort.set({ field: 'price', order: 'asc' });
    await settle();

    expect(requests[requests.length - 1].params?.sorters).toEqual([
      { field: 'price', order: 'asc' },
      { field: 'id', order: 'asc' },
    ]);
  });

  it('sends only the sort when it is on id', async () => {
    const requests = setUp([{ name: 'products' }], undefined, reply([], 100));
    const state = TestBed.runInInjectionContext(() =>
      injectResourceListState(signal('products')),
    );
    await settle();

    state.sort.set({ field: 'id', order: 'desc' });
    await settle();

    expect(requests[requests.length - 1].params?.sorters).toEqual([
      { field: 'id', order: 'desc' },
    ]);
  });

  it('returns to the default sorters when the sort is cleared', async () => {
    const requests = setUp(
      [{ name: 'products', defaultSorters: newestFirst }],
      undefined,
      reply([], 100),
    );
    const state = TestBed.runInInjectionContext(() =>
      injectResourceListState(signal('products')),
    );
    await settle();
    state.sort.set({ field: 'price', order: 'asc' });
    await settle();

    state.sort.set(null);
    await settle();

    expect(requests[requests.length - 1].params?.sorters).toEqual(newestFirst);
  });

  it('goes back to page 1 when the sort changes', async () => {
    const requests = setUp([{ name: 'products' }], undefined, reply([], 100));
    const state = TestBed.runInInjectionContext(() =>
      injectResourceListState(signal('products')),
    );
    await settle();
    state.page.set(3);
    await settle();

    state.sort.set({ field: 'price', order: 'asc' });
    await settle();

    expect(state.page()).toBe(1);
    expect(requests[requests.length - 1].params?.pagination?.current).toBe(1);
  });

  it('clears the sort when the resource changes', async () => {
    setUp([{ name: 'products' }, { name: 'tags' }], undefined, reply([], 100));
    const resource = signal('products');
    const state = TestBed.runInInjectionContext(() =>
      injectResourceListState(resource),
    );
    await settle();
    state.sort.set({ field: 'price', order: 'asc' });
    await settle();

    resource.set('tags');
    await settle();

    expect(state.sort()).toBeNull();
  });

  it('keeps the previous rows while a new sort loads on the same resource', async () => {
    const replies = switchableReply(reply(twoRows, 100));
    setUp([{ name: 'products' }], undefined, replies.reply);
    const state = TestBed.runInInjectionContext(() =>
      injectResourceListState(signal('products')),
    );
    await settle();
    expect(state.rows()).toEqual(twoRows);

    const pending = deferredReply();
    replies.use(pending.reply);
    state.sort.set({ field: 'price', order: 'asc' });
    await settle();

    expect(state.list.isLoading()).toBe(true);
    expect(state.rows()).toEqual(twoRows);

    pending.resolve(newRows);
    await settle();

    expect(state.list.isLoading()).toBe(false);
    expect(state.rows()).toEqual(newRows);
  });

  it('shows no rows when the sorted request fails', async () => {
    const replies = switchableReply(reply(twoRows, 100));
    setUp([{ name: 'products' }], undefined, replies.reply);
    const state = TestBed.runInInjectionContext(() =>
      injectResourceListState(signal('products')),
    );
    await settle();

    replies.use(() => Promise.reject(new Error('boom')));
    state.sort.set({ field: 'price', order: 'asc' });
    await settle();

    expect(state.rows()).toBeUndefined();
    expect(state.list.error()?.message).toBe('boom');
  });

  it('shows no previous rows after a resource change', async () => {
    const replies = switchableReply(reply(twoRows, 100));
    setUp([{ name: 'products' }, { name: 'tags' }], undefined, replies.reply);
    const resource = signal('products');
    const state = TestBed.runInInjectionContext(() =>
      injectResourceListState(resource),
    );
    await settle();
    expect(state.rows()).toEqual(twoRows);

    replies.use(deferredReply().reply);
    resource.set('tags');
    await settle();

    expect(state.rows()).toBeUndefined();
  });
});
