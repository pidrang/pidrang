import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePidrang } from '@pidrang/core';
import { provideSupabaseDataProvider } from '@pidrang/supabase';
import { createClient } from '@supabase/supabase-js';

import { routes } from './app.routes';
import { backend } from './backend';

const client = createClient(backend.url, backend.publishableKey);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    providePidrang({
      dataProvider: provideSupabaseDataProvider({ client }),
      resources: [
        {
          name: 'products',
          fields: [
            { name: 'id', type: 'text' },
            { name: 'name', type: 'text' },
            { name: 'price', type: 'number' },
          ],
        },
      ],
    }),
  ],
};
