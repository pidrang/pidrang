import { GeneratedFile } from './generated-file';
import { GENERATED_PAGE_FILES } from './generated-pages';

export const RESOURCE_ROUTES_SNIPPET = `import { Route } from '@angular/router';

import { canMatchResourceAction } from './can-match-resource-action';
import { RESOURCE_UNAVAILABLE_PATH } from './resource-unavailable-path';
import { NotFoundPage } from './pages/not-found-page';
import { ResourceCreatePage } from './pages/resource-create-page';
import { ResourceEditPage } from './pages/resource-edit-page';
import { ResourceListPage } from './pages/resource-list-page';
import { ResourceShowPage } from './pages/resource-show-page';

export const resourceRoutes: Route[] = [
  { path: RESOURCE_UNAVAILABLE_PATH, component: NotFoundPage },
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
];
`;

export function generatePagesBundle(): GeneratedFile[] {
  return GENERATED_PAGE_FILES;
}
