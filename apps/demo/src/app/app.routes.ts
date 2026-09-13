import { Route } from '@angular/router';

import { HomePage } from './pages/home-page';
import { ResourceCreatePage } from './pages/resource-create-page';
import { ResourceEditPage } from './pages/resource-edit-page';
import { ResourceListPage } from './pages/resource-list-page';
import { ResourceShowPage } from './pages/resource-show-page';

// Order matters: more specific segments (create, :id/edit) must be matched
// before the generic :id and :resource routes.
export const appRoutes: Route[] = [
  { path: '', component: HomePage },
  { path: ':resource/create', component: ResourceCreatePage },
  { path: ':resource/:id/edit', component: ResourceEditPage },
  { path: ':resource/:id', component: ResourceShowPage },
  { path: ':resource', component: ResourceListPage },
];
