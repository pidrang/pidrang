import { SupabaseClient } from '@supabase/supabase-js';

import { provideSupabaseDataProvider } from './provide-supabase-data-provider';
import { SupabaseDataProvider } from './supabase-data-provider';

describe('provideSupabaseDataProvider', () => {
  it('returns a SupabaseDataProvider wrapping the given client', () => {
    const client = {} as SupabaseClient;

    const dataProvider = provideSupabaseDataProvider({ client });

    expect(dataProvider).toBeInstanceOf(SupabaseDataProvider);
  });
});
