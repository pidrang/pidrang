import {
  DOCUMENT,
  Signal,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import {
  PidrangError,
  injectDataProvider,
  injectResourceList,
  isResourceActionEnabled,
} from '@pidrang/core';

import { DeleteFailure } from './delete-failure';
import { injectResourceDefinition } from './resource-definition';
import { recordLabel } from './record-label';
import { ResourceRow } from './resource-row';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function injectResourceListState(resource: Signal<string>) {
  const window = inject(DOCUMENT).defaultView;
  const dataProvider = injectDataProvider();
  const definition = injectResourceDefinition(resource);

  const deleting = linkedSignal<string, { id: string } | null>({
    source: resource,
    computation: () => null,
  });
  const deleteFailure = linkedSignal<string, DeleteFailure | null>({
    source: resource,
    computation: () => null,
  });
  const pageSize = signal(PAGE_SIZE_OPTIONS[0]);
  const page = linkedSignal({
    source: () => ({ resource: resource(), pageSize: pageSize() }),
    computation: () => 1,
  });
  const revision = signal(0);
  const list = injectResourceList<ResourceRow>(resource, () => {
    revision();
    return {
      pagination: { current: page(), pageSize: pageSize() },
      sorters: [{ field: 'id', order: 'asc' }],
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

  async function remove(row: ResourceRow): Promise<void> {
    if (!canDelete() || deleting() !== null) {
      return;
    }
    const current = resource();
    if (!window?.confirm(`Delete ${recordLabel(row)} from ${current}?`)) {
      return;
    }
    const operation = { id: row.id };
    deleting.set(operation);
    deleteFailure.set(null);
    try {
      await dataProvider.delete(current, { id: row.id });
      if (resource() === current) {
        revision.update((value) => value + 1);
      }
    } catch (err) {
      if (deleting() === operation) {
        deleteFailure.set({
          message: err instanceof Error ? err.message : String(err),
          category: err instanceof PidrangError ? err.category : 'unknown',
        });
      }
    } finally {
      if (deleting() === operation) {
        deleting.set(null);
      }
    }
  }

  return {
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    pageSize,
    page,
    lastPage,
    list,
    total,
    deleting,
    deleteFailure,
    canCreate,
    canShow,
    canEdit,
    canDelete,
    fields,
    remove,
  };
}
