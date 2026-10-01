import {
  DestroyRef,
  InjectionToken,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { AUTH_PROVIDER } from '@pidrang/core';

import { RunningSave } from './running-save';

export const SAVE_STORE = new InjectionToken<{
  saves: WritableSignal<ReadonlyMap<string, RunningSave>>;
  session: WritableSignal<number>;
}>('pidrang.saves', {
  providedIn: 'root',
  factory: () => {
    const store = {
      saves: signal<ReadonlyMap<string, RunningSave>>(new Map()),
      session: signal(0),
    };
    const unsubscribe = inject(AUTH_PROVIDER, {
      optional: true,
    })?.onSessionChange?.(() => store.session.update((value) => value + 1));
    if (unsubscribe) {
      inject(DestroyRef).onDestroy(unsubscribe);
    }
    return store;
  },
});
