import { Signal, computed, inject } from '@angular/core';
import {
  AUTH_PROVIDER,
  AuthSessionRef,
  injectAuthSession,
} from '@pidrang/core';

export interface AuthSessionState {
  readonly session: AuthSessionRef | null;
  readonly signedOut: Signal<boolean>;
  readonly sessionPending: Signal<boolean>;
  signOut(): Promise<void>;
}

export function injectAuthSessionState(): AuthSessionState {
  const authProvider = inject(AUTH_PROVIDER, { optional: true });
  if (authProvider === null) {
    return {
      session: null,
      signedOut: computed(() => false),
      sessionPending: computed(() => false),
      signOut: () => Promise.resolve(),
    };
  }
  const session = injectAuthSession();
  return {
    session,
    signedOut: computed(
      () => session.error() !== undefined || session.value() === null,
    ),
    sessionPending: computed(
      () => session.error() === undefined && session.value() === undefined,
    ),
    signOut: async () => {
      await authProvider.logout();
      session.reload();
    },
  };
}
