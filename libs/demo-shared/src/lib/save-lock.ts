import { Signal, computed, inject, linkedSignal, signal } from '@angular/core';

import { RunningSave } from './running-save';
import { SaveOutcome } from './save-outcome';
import { SAVE_STORE } from './save-store';
import { SaveTimeoutError } from './save-timeout-error';

const TIMEOUT_SECONDS = 30;

export function injectSaveLock(key: Signal<string>) {
  const store = inject(SAVE_STORE);
  const running = computed(() => store.saves().get(key()));
  const locked = computed(() => running() !== undefined);
  const timeout = computed(() => running()?.timeout() ?? null);
  const seen = linkedSignal<
    { key: string; entry: RunningSave | undefined },
    RunningSave | undefined
  >({
    source: () => ({ key: key(), entry: running() }),
    computation: (now, previous) =>
      now.entry ??
      (previous?.source.key === now.key ? previous.value : undefined),
  });
  const outcome = computed((): SaveOutcome | null => {
    const entry = seen();
    if (entry === undefined || entry.session !== store.session()) {
      return null;
    }
    return entry.outcome();
  });

  async function hold<T>(
    request: () => Promise<T>,
    after: (result: T) => Promise<void>,
  ): Promise<void> {
    const held = key();
    if (store.saves().has(held)) {
      throw new Error('This record is already being saved');
    }
    const entry: RunningSave = {
      outcome: signal<SaveOutcome | null>(null),
      timeout: signal<SaveTimeoutError | null>(null),
      session: store.session(),
    };
    const release = () =>
      store.saves.update((all) => {
        if (all.get(held) !== entry) {
          return all;
        }
        const next = new Map(all);
        next.delete(held);
        return next;
      });
    const fail = (error: unknown) => {
      entry.outcome.set({ ok: false, error });
      release();
      return error;
    };
    store.saves.update((all) => new Map(all).set(held, entry));

    let pending: Promise<T>;
    try {
      pending = request();
    } catch (error) {
      throw fail(error);
    }
    const expired = new SaveTimeoutError(TIMEOUT_SECONDS);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: T;
    try {
      result = await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(expired), TIMEOUT_SECONDS * 1000);
        }),
      ]);
    } catch (error) {
      if (error !== expired) {
        throw fail(error);
      }
      entry.timeout.set(expired);
      pending.then(() => {
        entry.outcome.set({ ok: true });
        release();
      }, fail);
      throw expired;
    } finally {
      clearTimeout(timer);
    }
    entry.outcome.set({ ok: true });
    try {
      await after(result);
    } finally {
      release();
    }
  }

  return { locked, timeout, outcome, hold };
}
