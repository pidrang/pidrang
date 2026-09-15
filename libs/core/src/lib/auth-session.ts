import { ResourceRef, resource } from '@angular/core';

import { AuthIdentity } from './auth-provider';
import { injectAuthProvider } from './inject-pidrang';

// Wraps AuthProvider.getIdentity in Angular's resource() so callers get a
// signal-based identity without depending on any UI layer. Loads once; call
// reload() after login()/logout() to refresh it.
export function injectAuthSession(): ResourceRef<AuthIdentity | null | undefined> {
  const authProvider = injectAuthProvider();

  return resource({
    loader: () => authProvider.getIdentity(),
  });
}
