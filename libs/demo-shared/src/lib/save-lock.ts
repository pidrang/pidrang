import {
  InjectionToken,
  Signal,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';

import { SaveOutcome } from './save-outcome';

interface SaveRecord {
  running: boolean;
  saved: number;
  outcome: SaveOutcome | null;
}

const SAVES = new InjectionToken<
  WritableSignal<ReadonlyMap<string, SaveRecord>>
>('pidrang.saves', {
  providedIn: 'root',
  factory: () => signal<ReadonlyMap<string, SaveRecord>>(new Map()),
});

export function injectSaveLock(key: Signal<string>) {
  const saves = inject(SAVES);
  const current = computed(
    () => saves().get(key()) ?? { running: false, saved: 0, outcome: null },
  );
  const locked = computed(() => current().running);
  const saved = computed(() => current().saved);
  const outcome = computed(() => current().outcome);

  function patch(held: string, change: (record: SaveRecord) => SaveRecord) {
    saves.update((all) =>
      new Map(all).set(
        held,
        change(all.get(held) ?? { running: false, saved: 0, outcome: null }),
      ),
    );
  }

  async function hold<T>(work: () => Promise<T>): Promise<T> {
    const held = key();
    patch(held, (record) => ({ ...record, running: true }));
    try {
      const result = await work();
      patch(held, (record) => ({
        running: false,
        saved: record.saved + 1,
        outcome: { ok: true },
      }));
      return result;
    } catch (error) {
      patch(held, (record) => ({
        ...record,
        running: false,
        outcome: { ok: false, error },
      }));
      throw error;
    }
  }

  return { locked, saved, outcome, hold };
}
