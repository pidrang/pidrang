import {
  ApplicationRef,
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthIdentity, AuthProvider } from './auth-provider';
import { DataProvider } from './data-provider';
import { injectAuthSession } from './auth-session';
import { providePidrang } from './provide-pidrang';

const noopDataProvider: DataProvider = {
  getList: <T>() =>
    Promise.resolve({ data: [], total: 0 } as { data: T[]; total: number }),
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

async function settle(): Promise<void> {
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
}

function subscribableAuthProvider(
  getIdentity: () => Promise<AuthIdentity | null>,
) {
  const listeners = new Set<() => void>();
  const provider: AuthProvider = {
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    getIdentity,
    onSessionChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    provider,
    listeners,
    notify: () => listeners.forEach((listener) => listener()),
  };
}

function configure(authProvider: AuthProvider): void {
  TestBed.configureTestingModule({
    providers: [
      providePidrang({
        dataProvider: noopDataProvider,
        resources: [],
        authProvider,
      }),
    ],
  });
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
      providers: [
        providePidrang({ dataProvider: noopDataProvider, resources: [] }),
      ],
    });

    expect(() =>
      TestBed.runInInjectionContext(() => injectAuthSession()),
    ).toThrow();
  });

  it('reloads every live consumer when the provider reports a session change', async () => {
    let identity: AuthIdentity | null = null;
    const auth = subscribableAuthProvider(() => Promise.resolve(identity));
    configure(auth.provider);

    const first = TestBed.runInInjectionContext(() => injectAuthSession());
    const second = TestBed.runInInjectionContext(() => injectAuthSession());
    await settle();
    expect(first.value()).toBeNull();
    expect(second.value()).toBeNull();

    identity = { id: '1' };
    auth.notify();
    await settle();
    expect(first.value()).toEqual({ id: '1' });
    expect(second.value()).toEqual({ id: '1' });

    identity = null;
    auth.notify();
    await settle();
    expect(first.value()).toBeNull();
    expect(second.value()).toBeNull();
  });

  it('unsubscribes when the consumer is destroyed', async () => {
    const auth = subscribableAuthProvider(() => Promise.resolve(null));
    configure(auth.provider);

    const injector = createEnvironmentInjector(
      [],
      TestBed.inject(EnvironmentInjector),
    );
    runInInjectionContext(injector, () => injectAuthSession());
    expect(auth.listeners.size).toBe(1);

    injector.destroy();

    expect(auth.listeners.size).toBe(0);
  });

  it('ignores a late response once the consumer is destroyed', async () => {
    let resolveIdentity: (identity: AuthIdentity | null) => void = () =>
      undefined;
    const auth = subscribableAuthProvider(
      () => new Promise((resolve) => (resolveIdentity = resolve)),
    );
    configure(auth.provider);

    const injector = createEnvironmentInjector(
      [],
      TestBed.inject(EnvironmentInjector),
    );
    const session = runInInjectionContext(injector, () => injectAuthSession());
    TestBed.tick();

    injector.destroy();
    resolveIdentity({ id: 'stale' });
    await settle();

    expect(session.value()).toBeUndefined();
  });

  it('keeps the newest identity when an older request resolves last', async () => {
    const pending: ((identity: AuthIdentity | null) => void)[] = [];
    const auth = subscribableAuthProvider(
      () => new Promise((resolve) => pending.push(resolve)),
    );
    configure(auth.provider);

    const session = TestBed.runInInjectionContext(() => injectAuthSession());
    TestBed.tick();
    auth.notify();
    TestBed.tick();
    expect(pending).toHaveLength(2);

    pending[1]({ id: 'new' });
    await Promise.resolve();
    pending[0]({ id: 'old' });
    await settle();

    expect(session.value()).toEqual({ id: 'new' });
  });

  it('surfaces a provider failure through error()', async () => {
    const failure = new Error('network down');
    const auth = subscribableAuthProvider(() => Promise.reject(failure));
    configure(auth.provider);

    const session = TestBed.runInInjectionContext(() => injectAuthSession());
    await settle();

    expect(session.error()).toBe(failure);
    expect(session.value()).toBeUndefined();
  });

  it('keeps the current identity while a session change reloads it', async () => {
    let resolveIdentity: (identity: AuthIdentity | null) => void = () =>
      undefined;
    let first = true;
    const auth = subscribableAuthProvider(() => {
      if (first) {
        first = false;
        return Promise.resolve({ id: '1' });
      }
      return new Promise((resolve) => (resolveIdentity = resolve));
    });
    configure(auth.provider);

    const session = TestBed.runInInjectionContext(() => injectAuthSession());
    await settle();
    expect(session.value()).toEqual({ id: '1' });

    auth.notify();
    TestBed.tick();
    expect(session.isLoading()).toBe(true);
    expect(session.value()).toEqual({ id: '1' });

    resolveIdentity({ id: '2' });
    await settle();
    expect(session.value()).toEqual({ id: '2' });
  });

  it('keeps a signed-out null while a session change reloads it', async () => {
    let loaded = false;
    const auth = subscribableAuthProvider(() => {
      if (!loaded) {
        loaded = true;
        return Promise.resolve(null);
      }
      return new Promise(() => undefined);
    });
    configure(auth.provider);

    const session = TestBed.runInInjectionContext(() => injectAuthSession());
    await settle();
    expect(session.value()).toBeNull();

    auth.notify();
    TestBed.tick();

    expect(session.isLoading()).toBe(true);
    expect(session.value()).toBeNull();
  });
});
