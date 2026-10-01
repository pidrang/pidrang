import { Route } from '@angular/router';

import { canMatchResourceAction } from './can-match-resource-action';
import { DemoPages } from './demo-pages';
import { RESOURCE_UNAVAILABLE_PATH } from './resource-unavailable-path';
import { SIGN_IN_ROUTE } from './sign-in-route';

export function demoRoutes(pages: DemoPages): Route[] {
  return [
    { path: '', component: pages.home },
    { path: SIGN_IN_ROUTE, component: pages.signIn },
    { path: RESOURCE_UNAVAILABLE_PATH, component: pages.notFound },
    {
      path: ':resource/create',
      component: pages.create,
      canMatch: [canMatchResourceAction('create')],
    },
    {
      path: ':resource/:id/edit',
      component: pages.edit,
      canMatch: [canMatchResourceAction('edit')],
    },
    {
      path: ':resource/:id',
      component: pages.show,
      canMatch: [canMatchResourceAction('show')],
    },
    {
      path: ':resource',
      component: pages.list,
      canMatch: [canMatchResourceAction('list')],
    },
    { path: '**', component: pages.notFound },
  ];
}
