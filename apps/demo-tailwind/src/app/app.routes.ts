import { Route } from '@angular/router';

import { canMatchResourceAction } from './can-match-resource-action';
import { HomePage } from './pages/home-page';
import { NotFoundPage } from './pages/not-found-page';
import { ResourceCreatePage } from './pages/resource-create-page';
import { ResourceEditPage } from './pages/resource-edit-page';
import { ResourceListPage } from './pages/resource-list-page';
import { ResourceShowPage } from './pages/resource-show-page';
import { SignInPage } from './pages/sign-in-page';

export const appRoutes: Route[] = [
  { path: '', component: HomePage },
  { path: 'login', component: SignInPage },
  { path: 'not-found', component: NotFoundPage },
  {
    path: ':resource/create',
    component: ResourceCreatePage,
    canMatch: [canMatchResourceAction('create')],
  },
  {
    path: ':resource/:id/edit',
    component: ResourceEditPage,
    canMatch: [canMatchResourceAction('edit')],
  },
  {
    path: ':resource/:id',
    component: ResourceShowPage,
    canMatch: [canMatchResourceAction('show')],
  },
  {
    path: ':resource',
    component: ResourceListPage,
    canMatch: [canMatchResourceAction('list')],
  },
  { path: '**', component: NotFoundPage },
];
