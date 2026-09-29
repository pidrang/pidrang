import { Signal, computed, resource as angularResource } from '@angular/core';
import { injectDataProvider } from '@pidrang/core';

import { recordLabel } from './record-label';

export function injectResourceRecord(
  resource: Signal<string>,
  id: Signal<string>,
) {
  const dataProvider = injectDataProvider();
  const record = angularResource({
    params: () => ({ resource: resource(), id: id() }),
    loader: ({ params }) =>
      dataProvider.getOne<Record<string, unknown>>(params.resource, {
        id: params.id,
      }),
  });
  const label: Signal<string> = computed(() =>
    record.hasValue() ? recordLabel(record.value()) : id(),
  );
  return { record, label };
}
