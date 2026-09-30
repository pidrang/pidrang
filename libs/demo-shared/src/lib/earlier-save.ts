import { Signal, computed, linkedSignal } from '@angular/core';

import { isAuthRequiredError } from './auth-required-error';
import { SaveFailure } from './save-failure';
import { SaveOutcome } from './save-outcome';

export function injectEarlierSave(
  key: Signal<string>,
  waiting: Signal<boolean>,
  outcome: Signal<SaveOutcome | null>,
) {
  const earlier = linkedSignal<
    { key: string; waiting: boolean; outcome: SaveOutcome | null },
    SaveOutcome | null
  >({
    source: () => ({ key: key(), waiting: waiting(), outcome: outcome() }),
    computation: (now, previous) => {
      if (previous === undefined || previous.source.key !== now.key) {
        return null;
      }
      if (previous.source.waiting && !now.waiting) {
        return now.outcome;
      }
      return previous.value;
    },
  });
  const finished = computed(() => earlier()?.ok === true);
  const failure = computed((): SaveFailure | null => {
    const result = earlier();
    if (result === null || result.ok) {
      return null;
    }
    return {
      message:
        result.error instanceof Error
          ? result.error.message
          : String(result.error),
      authRequired: isAuthRequiredError(result.error),
    };
  });

  function clear(): void {
    earlier.set(null);
  }

  return { finished, failure, clear };
}
