import { SupabaseClient } from '@supabase/supabase-js';

import { provideSupabaseAuthProvider } from './provide-supabase-auth-provider';
import { SupabaseAuthProvider } from './supabase-auth-provider';

describe('provideSupabaseAuthProvider', () => {
  it('returns a SupabaseAuthProvider wrapping the given client', () => {
    const client = {} as SupabaseClient;

    const authProvider = provideSupabaseAuthProvider({ client });

    expect(authProvider).toBeInstanceOf(SupabaseAuthProvider);
  });
});
