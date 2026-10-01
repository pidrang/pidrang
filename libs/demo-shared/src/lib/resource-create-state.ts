import {
  DestroyRef,
  ErrorHandler,
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
import { injectEarlierSave } from './earlier-save';
import { navigationFailure } from './navigation-failure';
import { injectResourceDefinition } from './resource-definition';
import { injectSaveLock } from './save-lock';
import { SaveFailure } from './save-failure';
import { SaveTimeoutError } from './save-timeout-error';

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
  const errorHandler = inject(ErrorHandler);
  const definition = injectResourceDefinition(resource);

  const target = computed(() => JSON.stringify(['create', resource()]));
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
  const created = linkedSignal<string, boolean>({
    source: target,
    computation: () => false,
  });
  const earlierSave = injectEarlierSave(target, waiting, lock.outcome);
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
    () => definition()?.fields?.filter((field) => !field.readOnly) ?? [],
  );
  const initialValue = computed(() =>
    Object.fromEntries(
      fields().map((field) => [field.name, defaultValueForField(field)]),
    ),
  );

  function owns(operation: object): boolean {
    return !destroyRef.destroyed && owned() === operation;
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
    if (!canCreate() || saving()) {
      return;
    }
    const current = resource();
    const operation = {};
    owned.set(operation);
    saveFailure.set(null);
    earlierSave.clear();
    try {
      await lock.hold(
        () => dataProvider.create<Record<string, unknown>>(current, { data }),
        async (row) => {
          if (
            owns(operation) &&
            !(await openNext(operation, destinationAfterCreate(row?.['id'])))
          ) {
            created.set(true);
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
    saving,
    savingElsewhere,
    stopped,
    earlierSave,
    created,
    saveFailure,
    canList,
    fields,
    initialValue,
    submit,
  };
}
