import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

import { DataProvider } from './data-provider';
import { Resource } from './resource';
import { DATA_PROVIDER, RESOURCES } from './tokens';

export interface PidrangConfig {
  dataProvider: DataProvider;
  resources: Resource[];
}

export function providePidrang(config: PidrangConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: DATA_PROVIDER, useValue: config.dataProvider },
    { provide: RESOURCES, useValue: config.resources },
  ]);
}
