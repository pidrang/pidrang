import { TestBed } from '@angular/core/testing';

import { DataProvider } from './data-provider';
import { injectDataProvider, injectResources } from './inject-pidrang';
import { providePidrang } from './provide-pidrang';

const noopDataProvider: DataProvider = {
  getList: <T>() => Promise.resolve({ data: [], total: 0 } as { data: T[]; total: number }),
  getOne: <T>() => Promise.resolve({} as T),
  create: <T>() => Promise.resolve({} as T),
  update: <T>() => Promise.resolve({} as T),
  delete: <T>() => Promise.resolve({} as T),
};

describe('providePidrang', () => {
  it('registers the data provider and resources for injection', () => {
    TestBed.configureTestingModule({
      providers: [
        providePidrang({
          dataProvider: noopDataProvider,
          resources: [{ name: 'users' }],
        }),
      ],
    });

    expect(TestBed.runInInjectionContext(injectDataProvider)).toBe(noopDataProvider);
    expect(TestBed.runInInjectionContext(injectResources)).toEqual([{ name: 'users' }]);
  });
});
