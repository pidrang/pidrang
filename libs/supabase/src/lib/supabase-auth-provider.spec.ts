import { AuthError, SupabaseClient, User } from '@supabase/supabase-js';

import { SupabaseAuthProvider } from './supabase-auth-provider';

function fakeClient(auth: {
  signInWithPassword?: ReturnType<typeof vi.fn>;
  signOut?: ReturnType<typeof vi.fn>;
  getUser?: ReturnType<typeof vi.fn>;
}) {
  return { auth } as unknown as SupabaseClient;
}

describe('SupabaseAuthProvider', () => {
  it('login signs in with the given credentials', async () => {
    const signInWithPassword = vi.fn(() => Promise.resolve({ error: null }));
    const provider = new SupabaseAuthProvider(fakeClient({ signInWithPassword }));

    await provider.login({ email: 'ada@example.com', password: 'secret' });

    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'secret' });
  });

  it('login throws a plain Error on auth failure', async () => {
    const signInWithPassword = vi.fn(() =>
      Promise.resolve({ error: { message: 'invalid credentials' } as AuthError }),
    );
    const provider = new SupabaseAuthProvider(fakeClient({ signInWithPassword }));

    await expect(provider.login({ email: 'ada@example.com', password: 'wrong' })).rejects.toThrow(
      'invalid credentials',
    );
  });

  it('logout signs the current session out', async () => {
    const signOut = vi.fn(() => Promise.resolve({ error: null }));
    const provider = new SupabaseAuthProvider(fakeClient({ signOut }));

    await provider.logout();

    expect(signOut).toHaveBeenCalled();
  });

  it('logout throws a plain Error on failure', async () => {
    const signOut = vi.fn(() => Promise.resolve({ error: { message: 'boom' } as AuthError }));
    const provider = new SupabaseAuthProvider(fakeClient({ signOut }));

    await expect(provider.logout()).rejects.toThrow('boom');
  });

  it('getIdentity returns the current user', async () => {
    const getUser = vi.fn(() =>
      Promise.resolve({ data: { user: { id: '1', email: 'ada@example.com' } as User }, error: null }),
    );
    const provider = new SupabaseAuthProvider(fakeClient({ getUser }));

    await expect(provider.getIdentity()).resolves.toEqual({ id: '1', email: 'ada@example.com' });
  });

  it('getIdentity returns null when there is no active session', async () => {
    const getUser = vi.fn(() =>
      Promise.resolve({ data: { user: null }, error: { message: 'no session' } as AuthError }),
    );
    const provider = new SupabaseAuthProvider(fakeClient({ getUser }));

    await expect(provider.getIdentity()).resolves.toBeNull();
  });
});
