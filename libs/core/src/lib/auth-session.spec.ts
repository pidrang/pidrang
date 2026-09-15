import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthIdentity, AuthProvider } from './auth-provider';
import { DataProvider } from './data-provider';
import { injectAuthSession } from './auth-session';
import { providePidrang } from './provide-pidrang';

const noopDataProvider: DataProvider = {
  getList: <T>() => Promise.resolve({ data: [], total: 0 } as { data: T[]; total: number }),
  getOne: <T>() => Promise.resolve({} as T),
  create: <T>() => Promise.resolve({} as T),
  update: <T>() => Promise.resolve({} as T),
  delete: <T>() => Promise.resolve({} as T),
};

function authProviderReturning(identity: AuthIdentity | null): AuthProvider {
  return {
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    getIdentity: () => Promise.resolve(identity),
  };
}

describe('injectAuthSession', () => {
  it('loads the current identity through the configured auth provider', async () => {
    const identity: AuthIdentity = { id: '1', email: 'ada@example.com' };
    TestBed.configureTestingModule({
      providers: [
        providePidrang({
          dataProvider: noopDataProvider,
          resources: [],
          authProvider: authProviderReturning(identity),
        }),
      ],
    });

    const session = TestBed.runInInjectionContext(() => injectAuthSession());

    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(session.value()).toEqual(identity);
  });

  it('reloads after reload() is called', async () => {
    let identity: AuthIdentity | null = null;
    TestBed.configureTestingModule({
      providers: [
        providePidrang({
          dataProvider: noopDataProvider,
          resources: [],
          authProvider: {
            login: () => Promise.resolve(),
            logout: () => Promise.resolve(),
            getIdentity: () => Promise.resolve(identity),
          },
        }),
      ],
    });

    const session = TestBed.runInInjectionContext(() => injectAuthSession());

    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(session.value()).toBeNull();

    identity = { id: '1' };
    session.reload();
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(session.value()).toEqual(identity);
  });

  it('throws when no auth provider is configured', () => {
    TestBed.configureTestingModule({
      providers: [providePidrang({ dataProvider: noopDataProvider, resources: [] })],
    });

    expect(() => TestBed.runInInjectionContext(() => injectAuthSession())).toThrow();
  });
});
