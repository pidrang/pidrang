import { Signal, computed } from '@angular/core';
import { Resource, injectResources } from '@pidrang/core';

export function injectResourceDefinition(
  resource: Signal<string>,
): Signal<Resource | undefined> {
  const resources = injectResources();
  return computed(() =>
    resources.find((candidate) => candidate.name === resource()),
  );
}
