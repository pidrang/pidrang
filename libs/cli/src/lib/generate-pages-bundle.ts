import { GeneratedFile } from './generated-file';
import { GENERATED_PAGE_FILES } from './generated-pages';

export const SIGN_IN_ROUTE_SNIPPET = `  {
    path: 'sign-in',
    loadComponent: () =>
      import('./pages/sign-in-page').then((page) => page.SignInPage),
  },
`;

export const RESOURCE_ROUTES_SNIPPET = `import { Route } from '@angular/router';

import {
  RESOURCE_UNAVAILABLE_PATH,
  canMatchResourceAction,
} from './pidrang/index';

export const resourceRoutes: Route[] = [
  {
    path: RESOURCE_UNAVAILABLE_PATH,
    loadComponent: () =>
      import('./pages/not-found-page').then((page) => page.NotFoundPage),
  },
${SIGN_IN_ROUTE_SNIPPET}  {
    path: ':resource/create',
    loadComponent: () =>
      import('./pages/resource-create-page').then(
        (page) => page.ResourceCreatePage,
      ),
    canMatch: [canMatchResourceAction('create')],
  },
  {
    path: ':resource/:id/edit',
    loadComponent: () =>
      import('./pages/resource-edit-page').then(
        (page) => page.ResourceEditPage,
      ),
    canMatch: [canMatchResourceAction('edit')],
  },
  {
    path: ':resource/:id',
    loadComponent: () =>
      import('./pages/resource-show-page').then(
        (page) => page.ResourceShowPage,
      ),
    canMatch: [canMatchResourceAction('show')],
  },
  {
    path: ':resource',
    loadComponent: () =>
      import('./pages/resource-list-page').then(
        (page) => page.ResourceListPage,
      ),
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

export function generateResourceRoutesFile(signIn = true): GeneratedFile {
  return {
    path: RESOURCE_ROUTES_FILE,
    content: signIn
      ? RESOURCE_ROUTES_SNIPPET
      : RESOURCE_ROUTES_SNIPPET.replace(SIGN_IN_ROUTE_SNIPPET, ''),
  };
}

export function generatePagesBundle(): GeneratedFile[] {
  return GENERATED_PAGE_FILES.map((file) => ({ ...file }));
}
