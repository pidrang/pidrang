import {
  ApplicationConfig,
  EnvironmentProviders,
  Provider,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePidrang } from '@pidrang/core';
import {
  provideSupabaseAuthProvider,
  provideSupabaseDataProvider,
} from '@pidrang/supabase';
import { createClient } from '@supabase/supabase-js';

import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';
import { DEMO_ACCOUNT } from './demo-account';
import { isSupabaseConfigured } from './is-supabase-configured';

const providers: (Provider | EnvironmentProviders)[] = [
  provideBrowserGlobalErrorListeners(),
  provideRouter(appRoutes, withComponentInputBinding()),
  { provide: DEMO_ACCOUNT, useValue: environment.demoAccount },
];

if (
  isSupabaseConfigured(environment.supabaseUrl, environment.supabaseAnonKey)
) {
  const supabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
  );

  providers.push(
    providePidrang({
      dataProvider: provideSupabaseDataProvider({ client: supabaseClient }),
      authProvider: provideSupabaseAuthProvider({ client: supabaseClient }),
      resources: [
        {
          name: 'users',
          fields: [
            { name: 'id', type: 'text' },
            { name: 'name', type: 'text' },
            { name: 'email', type: 'text' },
            { name: 'created_at', label: 'Created at', type: 'date' },
          ],
        },
        {
          name: 'products',
          fields: [
            { name: 'id', type: 'text' },
            { name: 'name', type: 'text' },
            { name: 'price', type: 'number' },
            { name: 'created_at', label: 'Created at', type: 'date' },
          ],
        },
        {
          name: 'orders',
          fields: [
            { name: 'id', type: 'text' },
            { name: 'user_id', label: 'User', type: 'text' },
            { name: 'total', type: 'number' },
            { name: 'created_at', label: 'Created at', type: 'date' },
          ],
        },
      ],
    }),
  );
}

export const appConfig: ApplicationConfig = {
  providers,
};
