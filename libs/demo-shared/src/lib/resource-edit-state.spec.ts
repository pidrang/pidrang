import { ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  AuthProvider,
  DataProvider,
  PidrangError,
  providePidrang,
} from '@pidrang/core';

import { injectResourceEditState } from './resource-edit-state';

describe('injectResourceEditState', () => {
  it('refuses a submit for a record another page is still saving', async () => {
    const writes: unknown[] = [];
    let finish: () => void = () => undefined;
    const dataProvider: DataProvider = {
      getList: () => Promise.reject(new Error('unused')),
      getOne: <T>() => Promise.resolve({ id: '1' } as T),
      create: () => Promise.reject(new Error('unused')),
      update: <T>(_resource: string, params: { data: unknown }) => {
        writes.push(params.data);
        return new Promise<T>((resolve) => (finish = () => resolve({} as T)));
      },
      delete: () => Promise.reject(new Error('unused')),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        providePidrang({ dataProvider, resources: [{ name: 'products' }] }),
      ],
    });
    const [first, second] = TestBed.runInInjectionContext(() => [
      injectResourceEditState(signal('products'), signal('1')),
      injectResourceEditState(signal('products'), signal('1')),
    ]);

    const running = first.submit({ name: 'First' });
    await second.submit({ name: 'Second' });

    expect(writes).toEqual([{ name: 'First' }]);
    finish();
    await running;
  });

  it('keeps the lock until the next page has opened, so a second submit sends nothing', async () => {
    const writes: unknown[] = [];
    const dataProvider: DataProvider = {
      getList: () => Promise.reject(new Error('unused')),
      getOne: <T>() => Promise.resolve({ id: '1' } as T),
      create: <T>(_resource: string, params: { data: unknown }) => {
        writes.push(params.data);
        return Promise.resolve({ id: '1' } as T);
      },
      update: <T>(_resource: string, params: { data: unknown }) => {
        writes.push(params.data);
        return Promise.resolve({} as T);
      },
      delete: () => Promise.reject(new Error('unused')),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        providePidrang({ dataProvider, resources: [{ name: 'products' }] }),
      ],
    });
    let opened: (value: boolean) => void = () => undefined;
    vi.spyOn(TestBed.inject(Router), 'navigate').mockReturnValue(
      new Promise((resolve) => (opened = resolve)),
    );
    const state = TestBed.runInInjectionContext(() =>
      injectResourceEditState(signal('products'), signal('1')),
    );

    const first = state.submit({ name: 'First' });
    await new Promise((resolve) => setTimeout(resolve));
    await state.submit({ name: 'Second' });

    expect(writes).toEqual([{ name: 'First' }]);
    opened(true);
    await first;
  });
});

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function setup(options: { withAuth: boolean } = { withAuth: true }) {
  const updates: ReturnType<typeof deferred<unknown>>[] = [];
  let reads = 0;
  let sessionChanged: () => void = () => undefined;
  const dataProvider: DataProvider = {
    getList: () => Promise.reject(new Error('unused')),
    getOne: <T>() => {
      reads += 1;
      return Promise.resolve({ id: '1', name: 'Mouse' } as T);
    },
    create: () => Promise.reject(new Error('unused')),
    update: <T>() => {
      const update = deferred<unknown>();
      updates.push(update);
      return update.promise as Promise<T>;
    },
    delete: () => Promise.reject(new Error('unused')),
  };
  const authProvider: AuthProvider = {
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    getIdentity: () => Promise.resolve(null),
    onSessionChange: (listener) => {
      sessionChanged = listener;
      return () => undefined;
    },
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      providePidrang({
        dataProvider,
        resources: [{ name: 'products' }],
        ...(options.withAuth ? { authProvider } : {}),
      }),
    ],
  });
  const navigate = vi
    .spyOn(TestBed.inject(Router), 'navigate')
    .mockResolvedValue(true);
  const page = (id = signal('1')) =>
    TestBed.runInInjectionContext(() =>
      injectResourceEditState(signal('products'), id),
    );
  const observe = (state: ReturnType<typeof page>) => ({
    waiting: state.savingElsewhere(),
    failure: state.earlierSave.failure(),
    finished: state.earlierSave.finished(),
  });
  const flush = async () => {
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
  };
  return {
    updates,
    reads: () => reads,
    changeSession: () => sessionChanged(),
    navigate,
    page,
    observe,
    flush,
  };
}

describe('injectResourceEditState across timeouts and sessions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('replaces the form with a timeout message until the update answers, then reads the record again', async () => {
    const { updates, navigate, page, reads, flush } = setup();
    const state = page();
    await flush();
    const running = state.submit({ name: 'First' });
    await vi.advanceTimersByTimeAsync(30_000);
    await running;
    await flush();

    expect(state.stopped()).toContain('No answer from the server');
    expect(state.earlierSave.failure()).toBeNull();
    expect(state.saveFailure()).toBeNull();
    await state.submit({ name: 'Second' });
    expect(updates).toHaveLength(1);
    const before = reads();

    updates[0].resolve({});
    await flush();

    expect(state.stopped()).toBeNull();
    expect(state.saving()).toBe(false);
    expect(state.earlierSave.finished()).toBe(true);
    expect(reads()).toBeGreaterThan(before);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('says when a timed-out update fails late, and keeps what was loaded', async () => {
    const { updates, page, reads, flush } = setup();
    const state = page();
    await flush();
    const running = state.submit({ name: 'First' });
    await vi.advanceTimersByTimeAsync(30_000);
    await running;
    await flush();
    state.earlierSave.failure();
    const before = reads();

    updates[0].reject(new Error('denied late'));
    await flush();

    expect(state.stopped()).toBeNull();
    expect(state.earlierSave.failure()?.message).toBe('denied late');
    expect(reads()).toBe(before);
  });

  it('keeps a timed-out record stopped for a page that comes back to it', async () => {
    const { updates, page, flush } = setup();
    const owner = page();
    void owner.submit({ name: 'First' });
    await vi.advanceTimersByTimeAsync(30_000);
    await flush();

    const back = page();
    await flush();

    expect(back.stopped()).toContain('No answer from the server');
    expect(back.savingElsewhere()).toBe(false);
    await back.submit({ name: 'Second' });
    expect(updates).toHaveLength(1);
  });

  it('tells a waiting page that the earlier save timed out, and reads the record once it answers', async () => {
    const { updates, page, observe, reads, flush } = setup();
    const owner = page();
    const waiting = page();
    await flush();
    void owner.submit({ name: 'First' });
    await flush();
    expect(observe(waiting).waiting).toBe(true);

    await vi.advanceTimersByTimeAsync(30_000);
    await flush();

    expect(waiting.stopped()).toContain('No answer from the server');
    expect(observe(waiting)).toEqual({
      waiting: false,
      failure: null,
      finished: false,
    });
    const before = reads();
    updates[0].resolve({});
    await flush();
    expect(waiting.stopped()).toBeNull();
    expect(reads()).toBeGreaterThan(before);
  });

  it('hides from a waiting page the outcome of a save from an earlier session, and reads the record again', async () => {
    const { updates, page, observe, reads, changeSession, flush } = setup();
    const owner = page();
    const waiting = page();
    await flush();
    const running = owner.submit({ name: 'First' });
    await flush();
    expect(observe(waiting).waiting).toBe(true);
    const before = reads();

    changeSession();
    updates[0].reject(new Error('permission denied for table products'));
    await running;
    await flush();

    expect(observe(waiting)).toEqual({
      waiting: false,
      failure: null,
      finished: false,
    });
    expect(reads()).toBeGreaterThan(before);
  });

  it('keeps the record locked across a session change until the save settles', async () => {
    const { updates, page, observe, changeSession, flush } = setup();
    const owner = page();
    const waiting = page();
    const running = owner.submit({ name: 'First' });
    await flush();

    changeSession();
    await flush();

    expect(owner.saving()).toBe(true);
    expect(observe(waiting).waiting).toBe(true);
    updates[0].resolve({});
    await running;
  });

  it('still shows its own failure to the page that saved, after a session change', async () => {
    const { updates, page, changeSession, flush } = setup();
    const owner = page();
    const running = owner.submit({ name: 'First' });

    changeSession();
    updates[0].reject(
      new PidrangError('JWT expired', { category: 'unauthenticated' }),
    );
    await running;
    await flush();

    expect(owner.saveFailure()).toEqual({
      message: 'JWT expired',
      authRequired: true,
    });
  });

  it('shows a waiting page the outcome of a save started after the session changed', async () => {
    const { updates, page, observe, changeSession, flush } = setup();
    const owner = page();
    const waiting = page();
    changeSession();
    await flush();
    const running = owner.submit({ name: 'First' });
    await flush();
    expect(observe(waiting).waiting).toBe(true);

    updates[0].reject(new Error('denied'));
    await running;
    await flush();

    expect(observe(waiting).failure?.message).toBe('denied');
  });

  it('shows nothing stale when a reused page comes back to a record whose save settled meanwhile', async () => {
    const { updates, page, observe, flush } = setup();
    const owner = page();
    const id = signal('1');
    const reused = page(id);
    const running = owner.submit({ name: 'First' });
    await flush();
    expect(observe(reused).waiting).toBe(true);

    id.set('2');
    await flush();
    observe(reused);
    updates[0].reject(new Error('denied'));
    await running;
    id.set('1');
    await flush();

    expect(observe(reused)).toEqual({
      waiting: false,
      failure: null,
      finished: false,
    });
  });

  it('saves without an auth provider', async () => {
    const { updates, navigate, page } = setup({ withAuth: false });
    const state = page();

    const running = state.submit({ name: 'First' });
    updates[0].resolve({});
    await running;

    expect(navigate).toHaveBeenCalledWith(['/', 'products', '1']);
  });

  it('says the record was saved when the next page fails, even if the error handler rethrows', async () => {
    const failure = new Error('chunk failed to load');
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ErrorHandler,
          useValue: {
            handleError: (error: unknown) => {
              throw error;
            },
          },
        },
      ],
    });
    const { updates, navigate, page, observe, flush } = setup();
    navigate.mockRejectedValue(failure);
    const owner = page();
    const waiting = page();
    observe(waiting);

    const running = owner.submit({ name: 'First' });
    await flush();
    observe(waiting);
    updates[0].resolve({});
    await running;
    await expect(vi.runAllTimersAsync()).rejects.toBe(failure);
    await flush();

    expect(owner.saveFailure()?.message).toBe(
      'Saved, but the next page could not open.',
    );
    expect(observe(waiting).finished).toBe(true);
  });

  it('does not report a next page that another navigation replaced', async () => {
    const { updates, navigate, page, flush } = setup();
    const router = TestBed.inject(Router);
    navigate.mockResolvedValue(false);
    vi.spyOn(router, 'currentNavigation').mockReturnValue(
      {} as ReturnType<Router['currentNavigation']>,
    );
    const owner = page();

    const running = owner.submit({ name: 'First' });
    updates[0].resolve({});
    await running;
    await flush();

    expect(owner.saveFailure()).toBeNull();
  });
});

describe('injectResourceEditState field visibility', () => {
  it('excludes readOnly and hidden fields from the editable fields', () => {
    const dataProvider: DataProvider = {
      getList: () => Promise.reject(new Error('unused')),
      getOne: <T>() => new Promise<T>(() => undefined),
      create: () => Promise.reject(new Error('unused')),
      update: () => Promise.reject(new Error('unused')),
      delete: () => Promise.reject(new Error('unused')),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        providePidrang({
          dataProvider,
          resources: [
            {
              name: 'products',
              fields: [
                { name: 'id', type: 'numeric', readOnly: true },
                { name: 'name', type: 'text' },
                { name: 'internal', type: 'text', hidden: true },
              ],
            },
          ],
        }),
      ],
    });
    const state = TestBed.runInInjectionContext(() =>
      injectResourceEditState(signal('products'), signal('1')),
    );

    expect(state.fields().map((field) => field.name)).toEqual(['name']);
  });
});
