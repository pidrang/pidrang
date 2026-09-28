import { DataProvider } from '@pidrang/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseDataProvider } from './supabase-data-provider';

export interface SupabaseDataProviderConfig {
  client: SupabaseClient;
}

export function provideSupabaseDataProvider(config: SupabaseDataProviderConfig): DataProvider {
  return new SupabaseDataProvider(config.client);
}
