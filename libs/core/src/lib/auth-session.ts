import {
  DestroyRef,
  ResourceRef,
  inject,
  resource,
  signal,
} from '@angular/core';

import { AuthIdentity } from './auth-provider';
import { injectAuthProvider } from './inject-pidrang';

export function injectAuthSession(): ResourceRef<
  AuthIdentity | null | undefined
> {
  const authProvider = injectAuthProvider();
  const sessionVersion = signal(0);

  const session = resource({
    params: () => sessionVersion(),
    loader: () => authProvider.getIdentity(),
  });

  const unsubscribe = authProvider.onSessionChange?.(() =>
    sessionVersion.update((version) => version + 1),
  );
  if (unsubscribe) {
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  return session;
}
