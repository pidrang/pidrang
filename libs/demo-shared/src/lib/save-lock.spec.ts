import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { providePidrang } from '@pidrang/core';

import { injectSaveLock } from './save-lock';
import { SAVE_STORE } from './save-store';

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function setup() {
  TestBed.configureTestingModule({
    providers: [
      providePidrang({
        dataProvider: {
          getList: () => Promise.reject(new Error('unused')),
          getOne: () => Promise.reject(new Error('unused')),
          create: () => Promise.reject(new Error('unused')),
          update: () => Promise.reject(new Error('unused')),
          delete: () => Promise.reject(new Error('unused')),
        },
        resources: [],
      }),
    ],
  });
  const key = signal('record');
  const lock = TestBed.runInInjectionContext(() => injectSaveLock(key));
  const store = TestBed.inject(SAVE_STORE);
  return { key, lock, store };
}

const done = async () => undefined;

describe('injectSaveLock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps only the saves still running', async () => {
    const { lock, store } = setup();
    const request = deferred<string>();

    const held = lock.hold(() => request.promise, done);
    expect(store.saves().size).toBe(1);
    request.resolve('saved');
    await held;

    expect(store.saves().size).toBe(0);
    expect(lock.locked()).toBe(false);
  });

  it('drops a failed save from the store too', async () => {
    const { lock, store } = setup();

    await expect(
      lock.hold(() => Promise.reject(new Error('denied')), done),
    ).rejects.toThrow('denied');

    expect(store.saves().size).toBe(0);
  });

  it('leaves no timer behind once a save settles', async () => {
    vi.useFakeTimers();
    const { lock } = setup();

    await lock.hold(() => Promise.resolve('saved'), done);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a newer save locked after an older save of the same record settled', async () => {
    vi.useFakeTimers();
    const { lock } = setup();
    await lock.hold(() => Promise.resolve('first'), done);
    const second = deferred<string>();

    const held = lock.hold(() => second.promise, done);
    await vi.advanceTimersByTimeAsync(29_000);

    expect(lock.locked()).toBe(true);
    second.resolve('second');
    await held;
  });

  it('reports a timeout and keeps the record locked until the request answers', async () => {
    vi.useFakeTimers();
    const { lock, store } = setup();
    const late = deferred<string>();

    const held = lock.hold(() => late.promise, done);
    const failed = expect(held).rejects.toThrow('No answer from the server');
    await vi.advanceTimersByTimeAsync(30_000);
    await failed;

    expect(lock.locked()).toBe(true);
    expect(lock.timeout()?.message).toContain('No answer from the server');
    late.resolve('late');
    await vi.advanceTimersByTimeAsync(0);
    expect(lock.locked()).toBe(false);
    expect(store.saves().size).toBe(0);
  });

  it('refuses a new save while a timed-out request has not answered', async () => {
    vi.useFakeTimers();
    const { lock } = setup();
    const late = deferred<string>();
    const first = lock.hold(() => late.promise, done).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(30_000);
    await first;

    await expect(
      lock.hold(() => Promise.resolve('second'), done),
    ).rejects.toThrow('already being saved');
    late.reject(new Error('late failure'));
    await vi.advanceTimersByTimeAsync(0);
    expect(lock.locked()).toBe(false);
  });

  it('records the save as done before the next step runs, even if that step throws', async () => {
    const { lock } = setup();

    const held = lock.hold(
      () => Promise.resolve('saved'),
      () => Promise.reject(new Error('next page failed')),
    );
    lock.outcome();
    await expect(held).rejects.toThrow('next page failed');

    expect(lock.outcome()).toEqual({ ok: true });
    expect(lock.locked()).toBe(false);
  });

  it('reports an outcome only for the record it was saved for', async () => {
    const { key, lock } = setup();
    const request = deferred<string>();
    const held = lock.hold(() => request.promise, done).catch(() => undefined);
    lock.outcome();
    request.reject(new Error('denied'));
    await held;
    expect(lock.outcome()).toEqual({ ok: false, error: new Error('denied') });

    key.set('other');

    expect(lock.outcome()).toBeNull();
  });

  it('refuses to hold a record that is already being saved', async () => {
    const { lock, store } = setup();
    const first = deferred<string>();
    const held = lock.hold(() => first.promise, done);

    await expect(
      lock.hold(() => Promise.resolve('second'), done),
    ).rejects.toThrow('already being saved');
    expect(store.saves().size).toBe(1);
    first.resolve('first');
    await held;
    expect(store.saves().size).toBe(0);
  });

  it('records the late answer of a save that timed out', async () => {
    vi.useFakeTimers();
    const { lock } = setup();
    const late = deferred<string>();
    const held = lock.hold(() => late.promise, done).catch(() => undefined);
    lock.outcome();
    await vi.advanceTimersByTimeAsync(30_000);
    await held;
    lock.outcome();

    late.reject(new Error('denied late'));
    await vi.advanceTimersByTimeAsync(0);

    expect(lock.outcome()).toEqual({
      ok: false,
      error: new Error('denied late'),
    });
  });
});
