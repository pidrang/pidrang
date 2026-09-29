import {
  DestroyRef,
  Signal,
  computed,
  inject,
  linkedSignal,
  signal,
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

  const saving = signal(false);
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

  function isCurrent(current: string): boolean {
    return !destroyRef.destroyed && current === resource();
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
    saving.set(true);
    saveFailure.set(null);
    try {
      const created = await dataProvider.create<Record<string, unknown>>(
        current,
        { data },
      );
      if (isCurrent(current)) {
        await router.navigate(destinationAfterCreate(created['id']));
      }
    } catch (err) {
      if (isCurrent(current)) {
        saveFailure.set({
          message: err instanceof Error ? err.message : String(err),
          authRequired: isAuthRequiredError(err),
        });
      }
    } finally {
      saving.set(false);
    }
  }

  return { saving, saveFailure, canList, fields, initialValue, submit };
}
