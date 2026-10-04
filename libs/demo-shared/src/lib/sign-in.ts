import { DestroyRef, ErrorHandler, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoginParams, injectAuthProvider } from '@pidrang/core';

import { SIGN_IN_STATE } from './sign-in-state';

const STALLED_AFTER_SECONDS = 30;

export function injectSignIn() {
  const state = inject(SIGN_IN_STATE);
  const authProvider = injectAuthProvider();
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  const errorHandler = inject(ErrorHandler);

  state.visits.update((count) => count + 1);
  destroyRef.onDestroy(() => {
    state.visits.update((count) => count - 1);
    if (state.visits() === 0) {
      state.error.set(null);
    }
  });

  async function signIn(credentials: LoginParams): Promise<void> {
    if (state.running()) {
      return;
    }
    state.running.set(true);
    state.stalled.set(false);
    state.error.set(null);
    const session = state.session();
    const timer = setTimeout(
      () => state.stalled.set(true),
      STALLED_AFTER_SECONDS * 1000,
    );
    try {
      await authProvider.login(credentials);
    } catch (err) {
      if (state.visits() > 0 && state.session() === session) {
        state.error.set(err instanceof Error ? err.message : String(err));
      }
      return;
    } finally {
      clearTimeout(timer);
      state.running.set(false);
      state.stalled.set(false);
    }
    if (destroyRef.destroyed) {
      return;
    }
    try {
      await router.navigate(['/']);
    } catch (err) {
      errorHandler.handleError(err);
    }
  }

  return {
    pending: state.running.asReadonly(),
    stalled: state.stalled.asReadonly(),
    error: state.error.asReadonly(),
    signIn,
  };
}
