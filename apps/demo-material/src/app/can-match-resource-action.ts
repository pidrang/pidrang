import { inject } from '@angular/core';
import { CanMatchFn, RedirectCommand, Router } from '@angular/router';
import {
  RESOURCES,
  ResourceAction,
  isResourceActionEnabled,
} from '@pidrang/core';

export function canMatchResourceAction(action: ResourceAction): CanMatchFn {
  return (_route, segments) => {
    const router = inject(Router);
    const resource = inject(RESOURCES, { optional: true })?.find(
      (candidate) => candidate.name === segments[0]?.path,
    );
    return (
      isResourceActionEnabled(resource, action) ||
      new RedirectCommand(router.parseUrl('/not-found'), {
        skipLocationChange: true,
      })
    );
  };
}
