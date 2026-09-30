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
import { injectResourceDefinition } from './resource-definition';
import { injectResourceRecord } from './resource-record';
import { injectSaveLock } from './save-lock';
import { SaveFailure } from './save-failure';

const NON_EDITABLE_FIELDS = new Set(['id', 'created_at']);

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
  const savingElsewhere = computed(() => saving() && owned() === null);
  const earlierSave = injectEarlierSave(target, savingElsewhere, lock.outcome);
  const revision = linkedSignal<{ waiting: boolean; saved: number }, number>({
    source: () => ({ waiting: savingElsewhere(), saved: lock.saved() }),
    computation: (now, previous) =>
      previous?.source.waiting && now.saved !== previous.source.saved
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
        (field) => !NON_EDITABLE_FIELDS.has(field.name) && !field.hidden,
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
      errorHandler.handleError(err);
    }
    if (!opened && owns(operation)) {
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
      await lock.hold(async () => {
        await dataProvider.update(currentResource, { id: currentId, data });
        if (owns(operation)) {
          await openNext(operation, destinationAfterSave());
        }
      });
    } catch (err) {
      if (owns(operation)) {
        saveFailure.set({
          message: err instanceof Error ? err.message : String(err),
          authRequired: isAuthRequiredError(err),
        });
      }
    }
  }

  return {
    saving,
    savingElsewhere,
    earlierSave,
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
