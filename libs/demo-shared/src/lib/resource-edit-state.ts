import {
  DestroyRef,
  ErrorHandler,
  Signal,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { injectDataProvider, isResourceActionEnabled } from '@pidrang/core';

import { isAuthRequiredError } from './auth-required-error';
import { injectEarlierSave } from './earlier-save';
import { navigationFailure } from './navigation-failure';
import {
  injectResourceDefinition,
  resourceTitle,
} from './resource-definition';
import { injectResourceRecord } from './resource-record';
import { injectSaveLock } from './save-lock';
import { SaveFailure } from './save-failure';
import { SaveOutcome } from './save-outcome';
import { SaveTimeoutError } from './save-timeout-error';

function mayHaveChanged(outcome: SaveOutcome | null): boolean {
  return outcome === null || outcome.ok;
}

export function injectResourceEditState(
  resource: Signal<string>,
  id: Signal<string>,
) {
  const dataProvider = injectDataProvider();
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  const errorHandler = inject(ErrorHandler);
  const definition = injectResourceDefinition(resource);
  const target = computed(() => JSON.stringify(['edit', resource(), id()]));
  const lock = injectSaveLock(target);
  const saving = lock.locked;
  const owned = linkedSignal<string, object | null>({
    source: target,
    computation: () => null,
  });
  const savingElsewhere = computed(
    () => saving() && owned() === null && lock.timeout() === null,
  );
  const stopped = computed(() => lock.timeout()?.message ?? null);
  const waiting = computed(() => savingElsewhere() || stopped() !== null);
  const earlierSave = injectEarlierSave(target, waiting, lock.outcome);
  const revision = linkedSignal<
    { waiting: boolean; outcome: SaveOutcome | null },
    number
  >({
    source: () => ({ waiting: waiting(), outcome: lock.outcome() }),
    computation: (now, previous) =>
      previous?.source.waiting && !now.waiting && mayHaveChanged(now.outcome)
        ? previous.value + 1
        : (previous?.value ?? 0),
  });
  const { record, label } = injectResourceRecord(resource, id, revision);
  const saveFailure = linkedSignal<
    { resource: string; id: string },
    SaveFailure | null
  >({
    source: () => ({ resource: resource(), id: id() }),
    computation: () => null,
  });
  const canShow = computed(() => isResourceActionEnabled(definition(), 'show'));
  const canList = computed(() => isResourceActionEnabled(definition(), 'list'));
  const canEdit = computed(() => isResourceActionEnabled(definition(), 'edit'));
  const fields = computed(
    () =>
      definition()?.fields?.filter(
        (field) => !field.readOnly && !field.hidden,
      ) ?? [],
  );
  const value = computed(() => {
    if (!record.hasValue()) {
      return undefined;
    }
    const current = record.value();
    return Object.fromEntries(
      fields().map((field) => [field.name, current[field.name]]),
    );
  });

  function owns(operation: object): boolean {
    return !destroyRef.destroyed && owned() === operation;
  }

  function destinationAfterSave(): unknown[] {
    if (canShow()) {
      return ['/', resource(), id()];
    }
    if (canList()) {
      return ['/', resource()];
    }
    return ['/'];
  }

  async function openNext(
    operation: object,
    destination: unknown[],
  ): Promise<boolean> {
    let opened = false;
    try {
      opened = await router.navigate(destination);
    } catch (err) {
      setTimeout(() => errorHandler.handleError(err));
    }
    if (!opened && owns(operation) && router.currentNavigation() === null) {
      saveFailure.set(navigationFailure());
    }
    return opened;
  }

  async function submit(data: Record<string, unknown>): Promise<void> {
    if (!canEdit() || saving()) {
      return;
    }
    const currentResource = resource();
    const currentId = id();
    const operation = {};
    owned.set(operation);
    saveFailure.set(null);
    earlierSave.clear();
    try {
      await lock.hold(
        () => dataProvider.update(currentResource, { id: currentId, data }),
        async () => {
          if (owns(operation)) {
            await openNext(operation, destinationAfterSave());
          }
        },
      );
    } catch (err) {
      if (owns(operation) && !(err instanceof SaveTimeoutError)) {
        saveFailure.set({
          message: err instanceof Error ? err.message : String(err),
          authRequired: isAuthRequiredError(err),
        });
      }
    }
  }

  return {
    title: resourceTitle(definition),
    saving,
    savingElsewhere,
    earlierSave,
    stopped,
    saveFailure,
    record,
    label,
    canShow,
    canList,
    fields,
    value,
    submit,
  };
}
