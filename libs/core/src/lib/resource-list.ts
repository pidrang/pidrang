import { ResourceRef, resource } from '@angular/core';

import { injectDataProvider } from './inject-pidrang';
import { ListParams, ListResult } from './list-params';

interface ListRequest {
  resourceName: string;
  listParams: ListParams | undefined;
}

export function injectResourceList<T>(
  resourceName: string | (() => string),
  params?: () => ListParams | undefined,
): ResourceRef<ListResult<T> | undefined> {
  const dataProvider = injectDataProvider();
  const resourceNameFn =
    typeof resourceName === 'function' ? resourceName : () => resourceName;

  return resource({
    params: (): ListRequest | undefined => {
      const listParams = params?.();
      if (params && listParams === undefined) {
        return undefined;
      }
      return { resourceName: resourceNameFn(), listParams };
    },
    loader: ({ params: request }) =>
      dataProvider.getList<T>(request.resourceName, request.listParams),
  });
}
