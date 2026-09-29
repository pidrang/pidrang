import { Signal, computed } from '@angular/core';
import { isResourceActionEnabled } from '@pidrang/core';

import { injectResourceDefinition } from './resource-definition';
import { injectResourceRecord } from './resource-record';

export function injectResourceShowState(
  resource: Signal<string>,
  id: Signal<string>,
) {
  const definition = injectResourceDefinition(resource);
  const { record, label } = injectResourceRecord(resource, id);
  const canList = computed(() => isResourceActionEnabled(definition(), 'list'));
  const fields = computed(() => definition()?.fields ?? []);
  return { record, label, canList, fields };
}
