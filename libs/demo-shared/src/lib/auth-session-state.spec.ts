import { TestBed } from '@angular/core/testing';
import {
  AuthIdentity,
  AuthProvider,
  DataProvider,
  providePidrang,
} from '@pidrang/core';

import { AuthSessionState, injectAuthSessionState } from './auth-session-state';

const dataProvider: DataProvider = {
  getList: () => Promise.reject(new Error('unused')),
  getOne: () => Promise.reject(new Error('unused')),
  create: () => Promise.reject(new Error('unused')),
  update: () => Promise.reject(new Error('unused')),
  delete: () => Promise.reject(new Error('unused')),
};

function authProviderFor(
  getIdentity: () => Promise<AuthIdentity | null>,
  onChange?: (listener: () => void) => void,
): AuthProvider {
  return {
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    getIdentity,
    onSessionChange: (listener) => {
      onChange?.(listener);
      return () => undefined;
    },
  };
}

function sessionState(authProvider?: AuthProvider): AuthSessionState {
  TestBed.configureTestingModule({
    providers: [
      providePidrang({
        dataProvider,
        resources: [],
        ...(authProvider === undefined ? {} : { authProvider }),
      }),
    ],
  });
  return TestBed.runInInjectionContext(() => injectAuthSessionState());
}

async function settle(): Promise<void> {
  for (let pass = 0; pass < 2; pass += 1) {
    TestBed.tick();
    await Promise.resolve();
  }
}

describe('injectAuthSessionState', () => {
  it('treats an app without an auth provider as open', async () => {
    const state = sessionState();

    await settle();

    expect(state.session).toBeNull();
    expect(state.signedOut()).toBe(false);
    expect(state.sessionPending()).toBe(false);
    await expect(state.signOut()).resolves.toBeUndefined();
  });

  it('waits while the identity is being read', async () => {
    const state = sessionState(
      authProviderFor(() => new Promise(() => undefined)),
    );

    await settle();

    expect(state.sessionPending()).toBe(true);
    expect(state.signedOut()).toBe(false);
  });

  it('treats a signed-in identity as open', async () => {
    const state = sessionState(
      authProviderFor(() => Promise.resolve({ id: 'writer' })),
    );

    await settle();

    expect(state.signedOut()).toBe(false);
    expect(state.sessionPending()).toBe(false);
  });

  it('treats a null identity as signed out', async () => {
    const state = sessionState(authProviderFor(() => Promise.resolve(null)));

    await settle();

    expect(state.signedOut()).toBe(true);
    expect(state.sessionPending()).toBe(false);
  });

  it('treats an unreadable session as signed out', async () => {
    const state = sessionState(
      authProviderFor(() => Promise.reject(new Error('down'))),
    );

    await settle();

    expect(state.signedOut()).toBe(true);
    expect(state.sessionPending()).toBe(false);
  });

  it('logs out once and reads the session again', async () => {
    let identity: AuthIdentity | null = { id: 'writer' };
    let notify: () => void = () => undefined;
    const provider = authProviderFor(
      () => Promise.resolve(identity),
      (listener) => {
        notify = listener;
      },
    );
    const logouts = vi.fn(() => {
      identity = null;
      notify();
      return Promise.resolve();
    });
    provider.logout = logouts;
    const state = sessionState(provider);
    await settle();
    expect(state.signedOut()).toBe(false);

    await state.signOut();
    await settle();

    expect(logouts).toHaveBeenCalledTimes(1);
    expect(state.signedOut()).toBe(true);
  });
});
