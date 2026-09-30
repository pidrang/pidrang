import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DataProvider } from './data-provider';
import { injectResourceList } from './resource-list';
import { providePidrang } from './provide-pidrang';

describe('injectResourceList', () => {
  it('loads a resource list through the configured data provider', async () => {
    const dataProvider: DataProvider = {
      getList: <T>(resource: string) =>
        Promise.resolve({ data: [{ id: '1', resource }], total: 1 } as {
          data: T[];
          total: number;
        }),
      getOne: <T>() => Promise.resolve({} as T),
      create: <T>() => Promise.resolve({} as T),
      update: <T>() => Promise.resolve({} as T),
      delete: <T>() => Promise.resolve({} as T),
    };

    TestBed.configureTestingModule({
      providers: [
        providePidrang({ dataProvider, resources: [{ name: 'users' }] }),
      ],
    });

    const list = TestBed.runInInjectionContext(() =>
      injectResourceList('users'),
    );

    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(list.value()).toEqual({
      data: [{ id: '1', resource: 'users' }],
      total: 1,
    });
  });

  it('reloads when a reactive resource name changes', async () => {
    const dataProvider: DataProvider = {
      getList: <T>(resource: string) =>
        Promise.resolve({ data: [{ id: '1', resource }], total: 1 } as {
          data: T[];
          total: number;
        }),
      getOne: <T>() => Promise.resolve({} as T),
      create: <T>() => Promise.resolve({} as T),
      update: <T>() => Promise.resolve({} as T),
      delete: <T>() => Promise.resolve({} as T),
    };

    TestBed.configureTestingModule({
      providers: [
        providePidrang({
          dataProvider,
          resources: [{ name: 'users' }, { name: 'products' }],
        }),
      ],
    });

    const resourceName = signal('users');
    const list = TestBed.runInInjectionContext(() =>
      injectResourceList(resourceName),
    );

    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(list.value()).toEqual({
      data: [{ id: '1', resource: 'users' }],
      total: 1,
    });

    resourceName.set('products');
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(list.value()).toEqual({
      data: [{ id: '1', resource: 'products' }],
      total: 1,
    });
  });
});
