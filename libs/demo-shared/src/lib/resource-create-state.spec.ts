import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { DataProvider, providePidrang } from '@pidrang/core';

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
