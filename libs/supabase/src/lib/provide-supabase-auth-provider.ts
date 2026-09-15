import { AuthProvider } from '@pidrang/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseAuthProvider } from './supabase-auth-provider';

export interface SupabaseAuthProviderConfig {
  client: SupabaseClient;
}

// Returns a plain AuthProvider, meant to be passed as providePidrang({ authProvider: ... }).
export function provideSupabaseAuthProvider(config: SupabaseAuthProviderConfig): AuthProvider {
  return new SupabaseAuthProvider(config.client);
}
