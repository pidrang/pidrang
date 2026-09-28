import {
  DestroyRef,
  ResourceSnapshot,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';

import { AuthIdentity } from './auth-provider';
import { AuthSessionRef } from './auth-session-ref';
import { injectAuthProvider } from './inject-pidrang';

type Identity = AuthIdentity | null | undefined;

export function injectAuthSession(): AuthSessionRef {
  const authProvider = injectAuthProvider();
  const sessionVersion = signal(0);

  const session = resource({
    params: () => sessionVersion(),
    loader: () => authProvider.getIdentity(),
  });

  const value = linkedSignal<ResourceSnapshot<Identity>, Identity>({
    source: session.snapshot,
    computation: (snapshot, previous) => {
      if (snapshot.status === 'error') {
        return undefined;
      }
      if (snapshot.status === 'loading' || snapshot.status === 'reloading') {
        return previous ? previous.value : snapshot.value;
      }
      return snapshot.value;
    },
  });

  const reload = (): void => sessionVersion.update((version) => version + 1);

  const unsubscribe = authProvider.onSessionChange?.(reload);
  if (unsubscribe) {
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  return {
    value: value.asReadonly(),
    error: session.error,
    isLoading: session.isLoading,
    reload,
  };
}
