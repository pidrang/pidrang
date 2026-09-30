import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { DataProvider, providePidrang } from '@pidrang/core';

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
