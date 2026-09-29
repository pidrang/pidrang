import {
  DestroyRef,
  Signal,
  computed,
  inject,
  linkedSignal,
  signal,
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

  const saving = signal(false);
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

  function isCurrent(currentResource: string, currentId: string): boolean {
    return (
      !destroyRef.destroyed &&
      currentResource === resource() &&
      currentId === id()
    );
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
    saving.set(true);
    saveFailure.set(null);
    try {
      await dataProvider.update(currentResource, { id: currentId, data });
      if (isCurrent(currentResource, currentId)) {
        await router.navigate(destinationAfterSave());
      }
    } catch (err) {
      if (isCurrent(currentResource, currentId)) {
        saveFailure.set({
          message: err instanceof Error ? err.message : String(err),
          authRequired: isAuthRequiredError(err),
        });
      }
    } finally {
      saving.set(false);
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
