import {
  DestroyRef,
  Signal,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  Field,
  injectDataProvider,
  isResourceActionEnabled,
} from '@pidrang/core';

import { isAuthRequiredError } from './auth-required-error';
import { injectResourceDefinition } from './resource-definition';
import { SaveFailure } from './save-failure';

const NON_EDITABLE_FIELDS = new Set(['id', 'created_at']);

function defaultValueForField(field: Field): unknown {
  switch (field.type) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    default:
      return '';
  }
}

export function injectResourceCreateState(resource: Signal<string>) {
  const dataProvider = injectDataProvider();
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  const definition = injectResourceDefinition(resource);

  const pending = linkedSignal<string, object | null>({
    source: resource,
    computation: () => null,
  });
  const saving = computed(() => pending() !== null);
  const saveFailure = linkedSignal<string, SaveFailure | null>({
    source: resource,
    computation: () => null,
  });
  const canList = computed(() => isResourceActionEnabled(definition(), 'list'));
  const canCreate = computed(() =>
    isResourceActionEnabled(definition(), 'create'),
  );
  const canShow = computed(() => isResourceActionEnabled(definition(), 'show'));
  const fields = computed(
    () =>
      definition()?.fields?.filter(
        (field) => !NON_EDITABLE_FIELDS.has(field.name),
      ) ?? [],
  );
  const initialValue = computed(() =>
    Object.fromEntries(
      fields().map((field) => [field.name, defaultValueForField(field)]),
    ),
  );

  function owns(operation: object): boolean {
    return !destroyRef.destroyed && pending() === operation;
  }

  function destinationAfterCreate(id: unknown): unknown[] {
    if (canList()) {
      return ['/', resource()];
    }
    if (canShow() && (typeof id === 'string' || typeof id === 'number')) {
      return ['/', resource(), id];
    }
    return ['/'];
  }

  async function submit(data: Record<string, unknown>): Promise<void> {
    if (!canCreate() || saving()) {
      return;
    }
    const current = resource();
    const operation = {};
    pending.set(operation);
    saveFailure.set(null);
    try {
      const created = await dataProvider.create<Record<string, unknown>>(
        current,
        { data },
      );
      if (owns(operation)) {
        await router.navigate(destinationAfterCreate(created['id']));
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

  return { saving, saveFailure, canList, fields, initialValue, submit };
}
