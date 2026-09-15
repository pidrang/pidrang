import { TestBed } from '@angular/core/testing';

import { AuthProvider } from './auth-provider';
import { DataProvider } from './data-provider';
import { injectAuthProvider, injectDataProvider, injectResources } from './inject-pidrang';
import { providePidrang } from './provide-pidrang';

const noopDataProvider: DataProvider = {
  getList: <T>() => Promise.resolve({ data: [], total: 0 } as { data: T[]; total: number }),
  getOne: <T>() => Promise.resolve({} as T),
  create: <T>() => Promise.resolve({} as T),
  update: <T>() => Promise.resolve({} as T),
  delete: <T>() => Promise.resolve({} as T),
};

const noopAuthProvider: AuthProvider = {
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  getIdentity: () => Promise.resolve(null),
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

  it('registers the auth provider only when one is given', () => {
    TestBed.configureTestingModule({
      providers: [
        providePidrang({
          dataProvider: noopDataProvider,
          resources: [],
          authProvider: noopAuthProvider,
        }),
      ],
    });

    expect(TestBed.runInInjectionContext(injectAuthProvider)).toBe(noopAuthProvider);
  });
});
