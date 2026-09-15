import { EnvironmentProviders, Provider, makeEnvironmentProviders } from '@angular/core';

import { AuthProvider } from './auth-provider';
import { DataProvider } from './data-provider';
import { Resource } from './resource';
import { AUTH_PROVIDER, DATA_PROVIDER, RESOURCES } from './tokens';

export interface PidrangConfig {
  dataProvider: DataProvider;
  resources: Resource[];
  authProvider?: AuthProvider;
}

export function providePidrang(config: PidrangConfig): EnvironmentProviders {
  const providers: Provider[] = [
    { provide: DATA_PROVIDER, useValue: config.dataProvider },
    { provide: RESOURCES, useValue: config.resources },
  ];

  if (config.authProvider) {
    providers.push({ provide: AUTH_PROVIDER, useValue: config.authProvider });
  }

  return makeEnvironmentProviders(providers);
}
