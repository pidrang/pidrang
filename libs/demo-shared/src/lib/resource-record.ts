import {
  Signal,
  computed,
  resource as angularResource,
  signal,
} from '@angular/core';
import { injectDataProvider } from '@pidrang/core';

import { recordLabel } from './record-label';

export function injectResourceRecord(
  resource: Signal<string>,
  id: Signal<string>,
  revision: Signal<number> = signal(0),
) {
  const dataProvider = injectDataProvider();
  const record = angularResource({
    params: () => ({ resource: resource(), id: id(), revision: revision() }),
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
