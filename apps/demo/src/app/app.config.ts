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
import { isSupabaseConfigured } from './is-supabase-configured';

const providers: (Provider | EnvironmentProviders)[] = [
  provideBrowserGlobalErrorListeners(),
  provideRouter(appRoutes, withComponentInputBinding()),
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
      resources: [{ name: 'users' }, { name: 'products' }, { name: 'orders' }],
    }),
  );
}

export const appConfig: ApplicationConfig = {
  providers,
};
