import {
  ApplicationConfig,
  EnvironmentProviders,
  Provider,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  Route,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';
import { providePidrang } from '@pidrang/core';
import {
  provideSupabaseAuthProvider,
  provideSupabaseDataProvider,
} from '@pidrang/supabase';
import { createClient } from '@supabase/supabase-js';

import { DEMO_ACCOUNT } from './demo-account';
import { DemoEnvironment } from './demo-environment';
import { DEMO_RESOURCES } from './demo-resources';
import { isSupabaseConfigured } from './is-supabase-configured';

export function demoAppConfig(
  environment: DemoEnvironment,
  routes: Route[],
): ApplicationConfig {
  const providers: (Provider | EnvironmentProviders)[] = [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
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
        resources: DEMO_RESOURCES,
      }),
    );
  }

  return { providers };
}
