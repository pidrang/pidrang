import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePidrang } from '@pidrang/core';
import {
  provideSupabaseAuthProvider,
  provideSupabaseDataProvider,
} from '@pidrang/supabase';
import { createClient } from '@supabase/supabase-js';

import { appRoutes } from './app.routes';
import { backend } from './backend';
import { provideSignInPath } from './pidrang/provide-sign-in-path';
import { resources } from './resources';

const client = createClient(backend.url, backend.publishableKey);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes, withComponentInputBinding()),
    providePidrang({
      dataProvider: provideSupabaseDataProvider({ client }),
      authProvider: provideSupabaseAuthProvider({ client }),
      resources: [...resources],
    }),
    provideSignInPath('/sign-in'),
  ],
};
