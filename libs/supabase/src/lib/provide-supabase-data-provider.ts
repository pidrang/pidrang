import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { DATA_PROVIDER } from '@pidrang/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseDataProvider } from './supabase-data-provider';

export interface SupabaseDataProviderConfig {
  client: SupabaseClient;
}

export function provideSupabaseDataProvider(config: SupabaseDataProviderConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: DATA_PROVIDER, useValue: new SupabaseDataProvider(config.client) },
  ]);
}
