import { PidrangError } from '@pidrang/core';
import {
  AuthApiError,
  AuthChangeEvent,
  AuthError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';

import { SupabaseAuthProvider } from './supabase-auth-provider';

function fakeClient(auth: {
  signInWithPassword?: ReturnType<typeof vi.fn>;
  signOut?: ReturnType<typeof vi.fn>;
  getUser?: ReturnType<typeof vi.fn>;
  onAuthStateChange?: ReturnType<typeof vi.fn>;
}) {
  return { auth } as unknown as SupabaseClient;
}

describe('SupabaseAuthProvider', () => {
  it('login signs in with the given credentials', async () => {
    const signInWithPassword = vi.fn(() => Promise.resolve({ error: null }));
    const provider = new SupabaseAuthProvider(
      fakeClient({ signInWithPassword }),
    );

    await provider.login({ email: 'ada@example.com', password: 'secret' });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'secret',
    });
  });

  it('login throws on auth failure', async () => {
    const signInWithPassword = vi.fn(() =>
      Promise.resolve({
        error: { message: 'invalid credentials' } as AuthError,
      }),
    );
    const provider = new SupabaseAuthProvider(
      fakeClient({ signInWithPassword }),
    );

    await expect(
      provider.login({ email: 'ada@example.com', password: 'wrong' }),
    ).rejects.toThrow('invalid credentials');
  });

  it('logout signs the current session out', async () => {
    const signOut = vi.fn(() => Promise.resolve({ error: null }));
    const provider = new SupabaseAuthProvider(fakeClient({ signOut }));

    await provider.logout();

    expect(signOut).toHaveBeenCalled();
  });

  it('logout throws on failure', async () => {
    const signOut = vi.fn(() =>
      Promise.resolve({ error: { message: 'boom' } as AuthError }),
    );
    const provider = new SupabaseAuthProvider(fakeClient({ signOut }));

    await expect(provider.logout()).rejects.toThrow('boom');
  });

  it('getIdentity returns the current user', async () => {
    const getUser = vi.fn(() =>
      Promise.resolve({
        data: { user: { id: '1', email: 'ada@example.com' } as User },
        error: null,
      }),
    );
    const provider = new SupabaseAuthProvider(fakeClient({ getUser }));

    await expect(provider.getIdentity()).resolves.toEqual({
      id: '1',
      email: 'ada@example.com',
    });
  });

  it('getIdentity returns null when there is no active session', async () => {
    const getUser = vi.fn(() =>
      Promise.resolve({
        data: { user: null },
        error: new AuthSessionMissingError(),
      }),
    );
    const provider = new SupabaseAuthProvider(fakeClient({ getUser }));

    await expect(provider.getIdentity()).resolves.toBeNull();
  });

  it('getIdentity returns null when the session no longer exists server-side', async () => {
    const getUser = vi.fn(() =>
      Promise.resolve({
        data: { user: null },
        error: new AuthApiError('Session not found', 403, 'session_not_found'),
      }),
    );
    const provider = new SupabaseAuthProvider(fakeClient({ getUser }));

    await expect(provider.getIdentity()).resolves.toBeNull();
  });

  it('getIdentity propagates network and server failures', async () => {
    const error = new AuthRetryableFetchError('Failed to fetch', 0);
    const getUser = vi.fn(() =>
      Promise.resolve({ data: { user: null }, error }),
    );
    const provider = new SupabaseAuthProvider(fakeClient({ getUser }));

    const failure = await provider.getIdentity().catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(PidrangError);
    expect(failure).toMatchObject({
      message: 'Failed to fetch',
      category: 'unknown',
      cause: error,
    });
  });

  describe('onSessionChange', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function subscribe() {
      let emit: (event: AuthChangeEvent) => void = () => undefined;
      const unsubscribe = vi.fn();
      const onAuthStateChange = vi.fn(
        (callback: (event: AuthChangeEvent) => void) => {
          emit = callback;
          return { data: { subscription: { unsubscribe } } };
        },
      );
      const provider = new SupabaseAuthProvider(
        fakeClient({ onAuthStateChange }),
      );
      const listener = vi.fn();
      const cleanup = provider.onSessionChange(listener);
      return {
        emit: (event: AuthChangeEvent) => emit(event),
        listener,
        cleanup,
        unsubscribe,
      };
    }

    it('notifies after sign-in, sign-out and user updates, outside the auth callback', () => {
      const { emit, listener } = subscribe();

      emit('SIGNED_IN');
      expect(listener).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(listener).toHaveBeenCalledTimes(1);

      emit('SIGNED_OUT');
      emit('USER_UPDATED');
      vi.runAllTimers();
      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('ignores events that do not change the identity', () => {
      const { emit, listener } = subscribe();

      emit('INITIAL_SESSION');
      emit('TOKEN_REFRESHED');
      vi.runAllTimers();

      expect(listener).not.toHaveBeenCalled();
    });

    it('returns a cleanup that unsubscribes from Supabase', () => {
      const { cleanup, unsubscribe } = subscribe();

      cleanup();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});
