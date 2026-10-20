import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  DataProvider,
  ListParams,
  Resource,
  providePidrang,
} from '@pidrang/core';

import { injectResourceListState } from './resource-list-state';

function setUp(resources: Resource[]) {
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
    providers: [provideRouter([]), providePidrang({ dataProvider, resources })],
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
