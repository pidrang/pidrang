import { TestBed } from '@angular/core/testing';

import { AuthProvider } from './auth-provider';
import { DataProvider } from './data-provider';
import { injectAuthProvider, injectResource } from './inject-pidrang';
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

describe('injectResource', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        providePidrang({
          dataProvider: noopDataProvider,
          resources: [{ name: 'users', label: 'Users' }],
        }),
      ],
    });
  });

  it('returns the resource matching the given name', () => {
    const result = TestBed.runInInjectionContext(() => injectResource('users'));
    expect(result).toEqual({ name: 'users', label: 'Users' });
  });

  it('throws when no resource matches the given name', () => {
    expect(() => TestBed.runInInjectionContext(() => injectResource('unknown'))).toThrow();
  });
});

describe('injectAuthProvider', () => {
  it('returns the configured auth provider', () => {
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

  it('throws when no auth provider is configured', () => {
    TestBed.configureTestingModule({
      providers: [providePidrang({ dataProvider: noopDataProvider, resources: [] })],
    });

    expect(() => TestBed.runInInjectionContext(injectAuthProvider)).toThrow();
  });
});
