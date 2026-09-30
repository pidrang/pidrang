import {
  DestroyRef,
  Signal,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { injectDataProvider, isResourceActionEnabled } from '@pidrang/core';

import { isAuthRequiredError } from './auth-required-error';
import { injectResourceDefinition } from './resource-definition';
import { injectResourceRecord } from './resource-record';
import { SaveFailure } from './save-failure';

const NON_EDITABLE_FIELDS = new Set(['id', 'created_at']);

export function injectResourceEditState(
  resource: Signal<string>,
  id: Signal<string>,
) {
  const dataProvider = injectDataProvider();
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  const definition = injectResourceDefinition(resource);
  const { record, label } = injectResourceRecord(resource, id);

  const pending = linkedSignal<{ resource: string; id: string }, object | null>(
    {
      source: () => ({ resource: resource(), id: id() }),
      computation: () => null,
    },
  );
  const saving = computed(() => pending() !== null);
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
    return !destroyRef.destroyed && pending() === operation;
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

  async function submit(data: Record<string, unknown>): Promise<void> {
    if (!canEdit() || saving()) {
      return;
    }
    const currentResource = resource();
    const currentId = id();
    const operation = {};
    pending.set(operation);
    saveFailure.set(null);
    try {
      await dataProvider.update(currentResource, { id: currentId, data });
      if (owns(operation)) {
        await router.navigate(destinationAfterSave());
      }
    } catch (err) {
      if (owns(operation)) {
        saveFailure.set({
          message: err instanceof Error ? err.message : String(err),
          authRequired: isAuthRequiredError(err),
        });
      }
    } finally {
      if (pending() === operation) {
        pending.set(null);
      }
    }
  }

  return {
    saving,
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
