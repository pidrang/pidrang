import { inject } from '@angular/core';
import { Route, Router } from '@angular/router';

import { guardedResourcesOf } from './guarded-resources';

function collect(routes: readonly Route[], names: Set<string>): void {
  for (const route of routes) {
    for (const guard of route.canMatch ?? []) {
      if (typeof guard === 'function') {
        for (const name of guardedResourcesOf(guard)) {
          names.add(name);
        }
      }
    }
    if (route.children !== undefined) {
      collect(route.children, names);
    }
  }
}

export function injectSignedInResources(): ReadonlySet<string> {
  const names = new Set<string>();
  collect(inject(Router).config, names);
  return names;
}
