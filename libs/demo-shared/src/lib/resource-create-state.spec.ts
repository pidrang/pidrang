import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthProvider, DataProvider, providePidrang } from '@pidrang/core';

import { injectResourceCreateState } from './resource-create-state';

describe('injectResourceCreateState', () => {
  it('refuses a submit for a resource another page is still creating on', async () => {
    const writes: unknown[] = [];
    let finish: () => void = () => undefined;
    const dataProvider: DataProvider = {
      getList: () => Promise.reject(new Error('unused')),
      getOne: () => Promise.reject(new Error('unused')),
      create: <T>(_resource: string, params: { data: unknown }) => {
        writes.push(params.data);
        return new Promise<T>((resolve) => (finish = () => resolve({} as T)));
      },
      update: () => Promise.reject(new Error('unused')),
      delete: () => Promise.reject(new Error('unused')),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        providePidrang({ dataProvider, resources: [{ name: 'products' }] }),
      ],
    });
    const [first, second] = TestBed.runInInjectionContext(() => [
      injectResourceCreateState(signal('products')),
      injectResourceCreateState(signal('products')),
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
      injectResourceCreateState(signal('products')),
    );

    const first = state.submit({ name: 'First' });
    await new Promise((resolve) => setTimeout(resolve));
    await state.submit({ name: 'Second' });

    expect(writes).toEqual([{ name: 'First' }]);
    opened(true);
    await first;
  });
});

function setupCreate() {
  const creates: ((row: unknown) => void)[] = [];
  let sessionChanged: () => void = () => undefined;
  const dataProvider: DataProvider = {
    getList: () => Promise.reject(new Error('unused')),
    getOne: () => Promise.reject(new Error('unused')),
    create: <T>() =>
      new Promise<T>((resolve) => creates.push((row) => resolve(row as T))),
    update: () => Promise.reject(new Error('unused')),
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
        authProvider,
      }),
    ],
  });
  const navigate = vi
    .spyOn(TestBed.inject(Router), 'navigate')
    .mockResolvedValue(true);
  const state = TestBed.runInInjectionContext(() =>
    injectResourceCreateState(signal('products')),
  );
  return { creates, navigate, state, changeSession: () => sessionChanged() };
}

describe('injectResourceCreateState across timeouts and sessions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('replaces the draft with a timeout message when the create never answers', async () => {
    const { creates, navigate, state } = setupCreate();

    const running = state.submit({ name: 'Webcam' });
    await vi.advanceTimersByTimeAsync(30_000);
    await running;

    expect(state.stopped()).toContain('No answer from the server');
    expect(state.saveFailure()).toBeNull();
    await state.submit({ name: 'Webcam' });
    expect(navigate).not.toHaveBeenCalled();
    expect(creates).toHaveLength(1);
  });

  it('opens the next page after a successful create even if the session changed meanwhile', async () => {
    const { creates, navigate, state, changeSession } = setupCreate();

    const running = state.submit({ name: 'Webcam' });
    changeSession();
    creates[0]({ id: '9' });
    await running;

    expect(navigate).toHaveBeenCalledWith(['/', 'products']);
  });

  it('tells a page that waited on a create that it timed out', async () => {
    const { state } = setupCreate();
    const waiting = TestBed.runInInjectionContext(() =>
      injectResourceCreateState(signal('products')),
    );
    waiting.savingElsewhere();
    waiting.earlierSave.failure();

    void state.submit({ name: 'Webcam' });
    waiting.savingElsewhere();
    waiting.earlierSave.failure();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(waiting.savingElsewhere()).toBe(false);
    expect(waiting.stopped()).toContain('No answer from the server');
  });

  it('says a timed-out create finished when it answers late', async () => {
    const { creates, state } = setupCreate();
    const running = state.submit({ name: 'Webcam' });
    await vi.advanceTimersByTimeAsync(30_000);
    await running;
    state.stopped();
    state.earlierSave.finished();

    creates[0]({ id: '9' });
    await vi.advanceTimersByTimeAsync(0);

    expect(state.stopped()).toBeNull();
    expect(state.earlierSave.finished()).toBe(true);
  });

  it('hides the draft without an error when another navigation replaced the next page', async () => {
    const { creates, navigate, state } = setupCreate();
    navigate.mockResolvedValue(false);
    vi.spyOn(TestBed.inject(Router), 'currentNavigation').mockReturnValue(
      {} as ReturnType<Router['currentNavigation']>,
    );

    const running = state.submit({ name: 'Webcam' });
    creates[0]({ id: '9' });
    await running;

    expect(state.created()).toBe(true);
    expect(state.saveFailure()).toBeNull();
  });
});

describe('injectResourceCreateState field visibility', () => {
  it('excludes readOnly fields from the editable fields and initial value', () => {
    const dataProvider: DataProvider = {
      getList: () => Promise.reject(new Error('unused')),
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
          resources: [
            {
              name: 'products',
              fields: [
                { name: 'id', type: 'numeric', readOnly: true },
                { name: 'name', type: 'text' },
              ],
            },
          ],
        }),
      ],
    });
    const state = TestBed.runInInjectionContext(() =>
      injectResourceCreateState(signal('products')),
    );

    expect(state.fields().map((field) => field.name)).toEqual(['name']);
    expect(state.initialValue()).toEqual({ name: '' });
  });
});
