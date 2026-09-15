import { inject } from '@angular/core';

import { AuthProvider } from './auth-provider';
import { DataProvider } from './data-provider';
import { Resource } from './resource';
import { AUTH_PROVIDER, DATA_PROVIDER, RESOURCES } from './tokens';

export function injectDataProvider(): DataProvider {
  return inject(DATA_PROVIDER);
}

// Throws instead of a generic DI error, since AUTH_PROVIDER is an optional
// token: most call sites want a clear "auth isn't configured" message.
export function injectAuthProvider(): AuthProvider {
  const authProvider = inject(AUTH_PROVIDER, { optional: true });
  if (!authProvider) {
    throw new Error('Pidrang: no auth provider configured, pass authProvider to providePidrang()');
  }
  return authProvider;
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
