import { DATA_PROVIDER } from '@pidrang/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { TestBed } from '@angular/core/testing';

import { provideSupabaseDataProvider } from './provide-supabase-data-provider';
import { SupabaseDataProvider } from './supabase-data-provider';

describe('provideSupabaseDataProvider', () => {
  it('registers a SupabaseDataProvider under the core DATA_PROVIDER token', () => {
    const client = {} as SupabaseClient;

    TestBed.configureTestingModule({
      providers: [provideSupabaseDataProvider({ client })],
    });

    expect(TestBed.inject(DATA_PROVIDER)).toBeInstanceOf(SupabaseDataProvider);
  });
});
