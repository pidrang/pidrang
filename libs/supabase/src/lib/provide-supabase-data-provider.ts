import { DataProvider } from '@pidrang/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseDataProvider } from './supabase-data-provider';

export interface SupabaseDataProviderConfig {
  client: SupabaseClient;
}

// Returns a plain DataProvider, meant to be passed as providePidrang({ dataProvider: ... }).
export function provideSupabaseDataProvider(config: SupabaseDataProviderConfig): DataProvider {
  return new SupabaseDataProvider(config.client);
}
