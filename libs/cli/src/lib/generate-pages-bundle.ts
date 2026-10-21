import { GeneratedFile } from './generated-file';
import { GENERATED_PAGE_FILES } from './generated-pages';

export const RESOURCE_ROUTES_SNIPPET = `import { Route } from '@angular/router';

import { NotFoundPage } from './pages/not-found-page';
import { ResourceCreatePage } from './pages/resource-create-page';
import { ResourceEditPage } from './pages/resource-edit-page';
import { ResourceListPage } from './pages/resource-list-page';
import { ResourceShowPage } from './pages/resource-show-page';
import { RESOURCE_UNAVAILABLE_PATH, canMatchResourceAction } from './pidrang/index';

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

export const SIGN_IN_PATH_SNIPPET = `import { provideSignInPath } from './pidrang/provide-sign-in-path';

provideSignInPath('/your-sign-in-route')
`;

export interface UiLayerPackages {
  install: string[];
  ngAdd: string[];
}

export const PAGES_UI_LAYER_PACKAGES: UiLayerPackages = {
  install: ['@pidrang/material'],
  ngAdd: ['@angular/material'],
};

export const RESOURCE_ROUTES_FILE = 'src/app/resource-routes.ts';

export function generateResourceRoutesFile(): GeneratedFile {
  return { path: RESOURCE_ROUTES_FILE, content: RESOURCE_ROUTES_SNIPPET };
}

export function generatePagesBundle(): GeneratedFile[] {
  return GENERATED_PAGE_FILES.map((file) => ({ ...file }));
}
