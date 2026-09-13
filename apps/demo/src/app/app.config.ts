import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePidrang } from '@pidrang/core';
import { provideSupabaseDataProvider } from '@pidrang/supabase';
import { createClient } from '@supabase/supabase-js';

import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    providePidrang({
      dataProvider: provideSupabaseDataProvider({
        client: createClient(environment.supabaseUrl, environment.supabaseAnonKey),
      }),
      resources: [{ name: 'users' }, { name: 'products' }, { name: 'orders' }],
    }),
  ],
};
