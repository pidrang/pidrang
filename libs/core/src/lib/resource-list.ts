import { ResourceRef, resource } from '@angular/core';

import { injectDataProvider } from './inject-pidrang';
import { ListParams, ListResult } from './list-params';

// Wraps DataProvider.getList in Angular's resource() so callers get
// signal-based value/status/error/reload without depending on any UI layer.
//
// Returning undefined from `params` skips loading (Angular resource()
// convention), so it is only forwarded when the caller supplies one.
export function injectResourceList<T>(
  resourceName: string,
  params?: () => ListParams | undefined,
): ResourceRef<ListResult<T> | undefined> {
  const dataProvider = injectDataProvider();

  if (params) {
    return resource({
      params,
      loader: ({ params: listParams }) => dataProvider.getList<T>(resourceName, listParams),
    });
  }

  return resource({
    loader: () => dataProvider.getList<T>(resourceName),
  });
}
