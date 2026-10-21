import {
  DOCUMENT,
  DestroyRef,
  Signal,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import {
  injectDataProvider,
  injectResourceList,
  isResourceActionEnabled,
} from '@pidrang/core';

import { DeleteFailure } from './delete-failure';
import { deleteFailureOf } from './delete-failure-of';
import { injectEarlierSave } from './earlier-save';
import {
  injectResourceDefinition,
  resourceTitle,
} from './resource-definition';
import { recordLabel } from './record-label';
import { ResourceRow } from './resource-row';
import { injectSaveLock } from './save-lock';
import { SaveOutcome } from './save-outcome';
import { SAVE_STORE } from './save-store';
import { SaveTimeoutError } from './save-timeout-error';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const DELETE_TIMEOUT_MESSAGE =
  'No answer from the server after 30 seconds. The delete may still be applied, so delete stays disabled until the server answers.';

function mayHaveChanged(outcome: SaveOutcome | null): boolean {
  return outcome === null || outcome.ok;
}

export function injectResourceListState(resource: Signal<string>) {
  const window = inject(DOCUMENT).defaultView;
  const dataProvider = injectDataProvider();
  const destroyRef = inject(DestroyRef);
  const store = inject(SAVE_STORE);
  const definition = injectResourceDefinition(resource);

  const target = computed(() => JSON.stringify(['delete', resource()]));
  const lock = injectSaveLock(target);
  const owned = linkedSignal<string, { id: string } | null>({
    source: target,
    computation: () => null,
  });
  const deleteLocked = lock.locked;
  const deleting = computed(() => (lock.locked() ? owned() : null));
  const deletingElsewhere = computed(
    () => lock.locked() && owned() === null && lock.timeout() === null,
  );
  const stopped = computed(() =>
    lock.timeout() === null ? null : DELETE_TIMEOUT_MESSAGE,
  );
  const waiting = computed(() => deletingElsewhere() || stopped() !== null);
  const shown = computed(() => JSON.stringify([target(), store.session()]));
  const earlier = injectEarlierSave(shown, waiting, lock.outcome);
  const earlierDelete = {
    finished: earlier.finished,
    failure: computed((): DeleteFailure | null => {
      const outcome = earlier.outcome();
      return outcome === null || outcome.ok
        ? null
        : deleteFailureOf(outcome.error);
    }),
  };
  const deleteFailure = linkedSignal<string, DeleteFailure | null>({
    source: shown,
    computation: () => null,
  });
  const pageSize = signal(PAGE_SIZE_OPTIONS[0]);
  const page = linkedSignal({
    source: () => ({ resource: resource(), pageSize: pageSize() }),
    computation: () => 1,
  });
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
  const list = injectResourceList<ResourceRow>(resource, () => {
    revision();
    return {
      pagination: { current: page(), pageSize: pageSize() },
      sorters: definition()?.defaultSorters ?? [{ field: 'id', order: 'asc' }],
    };
  });
  const total = linkedSignal<
    { resource: string; total: number | undefined },
    number | undefined
  >({
    source: () => ({
      resource: resource(),
      total: list.hasValue() ? list.value().total : undefined,
    }),
    computation: (source, previous) =>
      source.total ??
      (previous?.source.resource === source.resource
        ? previous.value
        : undefined),
  });
  const lastPage = computed(() =>
    Math.max(1, Math.ceil((total() ?? 0) / pageSize())),
  );
  const canCreate = computed(() =>
    isResourceActionEnabled(definition(), 'create'),
  );
  const canShow = computed(() => isResourceActionEnabled(definition(), 'show'));
  const canEdit = computed(() => isResourceActionEnabled(definition(), 'edit'));
  const canDelete = computed(() =>
    isResourceActionEnabled(definition(), 'delete'),
  );
  const fields = computed(
    () => definition()?.fields?.filter((field) => !field.hidden) ?? [],
  );

  effect(() => {
    if (!list.hasValue()) {
      return;
    }
    const last = Math.max(1, Math.ceil(list.value().total / pageSize()));
    if (page() > last) {
      page.set(last);
    }
  });

  function owns(operation: object): boolean {
    return !destroyRef.destroyed && owned() === operation;
  }

  async function remove(row: ResourceRow): Promise<void> {
    if (!canDelete() || lock.locked()) {
      return;
    }
    const current = resource();
    if (!window?.confirm(`Delete ${recordLabel(row)} from ${current}?`)) {
      return;
    }
    const operation = { id: row.id };
    const session = store.session();
    owned.set(operation);
    deleteFailure.set(null);
    earlier.clear();
    try {
      await lock.hold(
        () => dataProvider.delete(current, { id: row.id }),
        async () => {
          if (owns(operation)) {
            revision.update((value) => value + 1);
          }
        },
      );
    } catch (err) {
      if (
        owns(operation) &&
        store.session() === session &&
        !(err instanceof SaveTimeoutError)
      ) {
        deleteFailure.set(deleteFailureOf(err));
      }
    } finally {
      if (owned() === operation && !lock.locked()) {
        owned.set(null);
      }
    }
  }

  return {
    title: resourceTitle(definition),
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    pageSize,
    page,
    lastPage,
    list,
    total,
    deleting,
    deleteLocked,
    deletingElsewhere,
    stopped,
    earlierDelete,
    deleteFailure,
    canCreate,
    canShow,
    canEdit,
    canDelete,
    fields,
    remove,
  };
}
