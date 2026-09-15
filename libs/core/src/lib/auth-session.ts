import { ResourceRef, resource } from '@angular/core';

import { AuthIdentity } from './auth-provider';
import { injectAuthProvider } from './inject-pidrang';

export function injectAuthSession(): ResourceRef<AuthIdentity | null | undefined> {
  const authProvider = injectAuthProvider();

  return resource({
    loader: () => authProvider.getIdentity(),
  });
}
