import { inject } from '@angular/core';

import { DataProvider } from './data-provider';
import { Resource } from './resource';
import { DATA_PROVIDER, RESOURCES } from './tokens';

export function injectDataProvider(): DataProvider {
  return inject(DATA_PROVIDER);
}

export function injectResources(): Resource[] {
  return inject(RESOURCES);
}

// Throws instead of returning undefined so a typo in a resource name fails fast.
export function injectResource(name: string): Resource {
  const found = injectResources().find((resource) => resource.name === name);
  if (!found) {
    throw new Error(`Pidrang: no resource registered with name "${name}"`);
  }
  return found;
}
