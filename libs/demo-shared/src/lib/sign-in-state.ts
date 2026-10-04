import {
  DestroyRef,
  InjectionToken,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { AUTH_PROVIDER } from '@pidrang/core';

export const SIGN_IN_STATE = new InjectionToken<{
  running: WritableSignal<boolean>;
  stalled: WritableSignal<boolean>;
  error: WritableSignal<string | null>;
  visits: WritableSignal<number>;
  session: WritableSignal<number>;
}>('pidrang.signInState', {
  providedIn: 'root',
  factory: () => {
    const state = {
      running: signal(false),
      stalled: signal(false),
      error: signal<string | null>(null),
      visits: signal(0),
      session: signal(0),
    };
    const unsubscribe = inject(AUTH_PROVIDER, {
      optional: true,
    })?.onSessionChange?.(() => {
      state.session.update((value) => value + 1);
      state.error.set(null);
    });
    if (unsubscribe) {
      inject(DestroyRef).onDestroy(unsubscribe);
    }
    return state;
  },
});
