import {
  DestroyRef,
  EnvironmentProviders,
  Provider,
  inject,
  makeEnvironmentProviders,
  signal,
  WritableSignal,
} from '@angular/core';

import { AuthIdentity, AuthProvider } from './auth-provider';
import { DataProvider } from './data-provider';
import { Resource } from './resource';
import { SESSION_IDENTITY } from './session-identity';
import { AUTH_PROVIDER, DATA_PROVIDER, RESOURCES } from './tokens';

export interface PidrangConfig {
  dataProvider: DataProvider;
  resources: Resource[];
  authProvider?: AuthProvider;
}

function watchIdentity(
  authProvider: AuthProvider,
): WritableSignal<AuthIdentity | null> {
  const identity = signal<AuthIdentity | null>(null);
  let latestRequest = 0;
  const refresh = (): void => {
    const request = ++latestRequest;
    authProvider.getIdentity().then(
      (current) => {
        if (request === latestRequest) {
          identity.set(current);
        }
      },
      () => undefined,
    );
  };
  const unsubscribe = authProvider.onSessionChange?.(refresh);
  if (unsubscribe) {
    inject(DestroyRef).onDestroy(unsubscribe);
  }
  refresh();
  return identity;
}

export function providePidrang(config: PidrangConfig): EnvironmentProviders {
  const providers: Provider[] = [
    { provide: DATA_PROVIDER, useValue: config.dataProvider },
    { provide: RESOURCES, useValue: config.resources },
  ];

  const authProvider = config.authProvider;
  if (authProvider) {
    providers.push(
      { provide: AUTH_PROVIDER, useValue: authProvider },
      {
        provide: SESSION_IDENTITY,
        useFactory: () => watchIdentity(authProvider),
      },
    );
  }

  return makeEnvironmentProviders(providers);
}
