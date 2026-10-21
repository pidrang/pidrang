import { Signal, computed } from '@angular/core';
import { Resource, injectResources } from '@pidrang/core';

export function resourceTitle(
  definition: Signal<Resource | undefined>,
): Signal<string> {
  return computed(() => {
    const resource = definition();
    return resource?.label ?? resource?.name ?? '';
  });
}

export function injectResourceDefinition(
  resource: Signal<string>,
): Signal<Resource | undefined> {
  const resources = injectResources();
  return computed(() =>
    resources.find((candidate) => candidate.name === resource()),
  );
}
