import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePidrang } from '@pidrang/core';
import { provideSupabaseAuthProvider, provideSupabaseDataProvider } from '@pidrang/supabase';
import { createClient } from '@supabase/supabase-js';

import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';

// One client shared by both providers: supabase-js warns about multiple
// GoTrueClient instances on the same page when auth state is duplicated.
const supabaseClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    providePidrang({
      dataProvider: provideSupabaseDataProvider({ client: supabaseClient }),
      authProvider: provideSupabaseAuthProvider({ client: supabaseClient }),
      resources: [{ name: 'users' }, { name: 'products' }, { name: 'orders' }],
    }),
  ],
};
