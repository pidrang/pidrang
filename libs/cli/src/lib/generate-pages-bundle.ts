import { GeneratedFile } from './generated-file';
import { GENERATED_PAGE_FILES } from './generated-pages';
import { quote } from './quote';

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

const GUARD_IMPORT_LINE =
  "  canMatchResourceAction,\n} from './pidrang/index';";

const GUARD_IMPORT_WITH_SIGNED_IN = `  canMatchResourceAction,
  canMatchSignedIn,
} from './pidrang/index';`;

const ACTION_GUARD =
  /^[^\S\n]{4}canMatch: \[(canMatchResourceAction\('[a-z]+'\))\],$/gm;

function addSignedInGuard(
  content: string,
  resources: readonly string[],
): string {
  const names = resources.map(quote).join(', ');
  const guard = `canMatchSignedIn([${names}])`;
  return content
    .replace(GUARD_IMPORT_LINE, GUARD_IMPORT_WITH_SIGNED_IN)
    .replace(
      ACTION_GUARD,
      (_, action: string) =>
        `    canMatch: [\n      ${guard},\n      ${action},\n    ],`,
    );
}

export function generateResourceRoutesFile(
  signIn = true,
  signedInResources: readonly string[] = [],
): GeneratedFile {
  const content = signIn
    ? RESOURCE_ROUTES_SNIPPET
    : RESOURCE_ROUTES_SNIPPET.replace(SIGN_IN_ROUTE_SNIPPET, '');
  return {
    path: RESOURCE_ROUTES_FILE,
    content:
      signedInResources.length === 0
        ? content
        : addSignedInGuard(content, signedInResources),
  };
}

export function generatePagesBundle(): GeneratedFile[] {
  return GENERATED_PAGE_FILES.map((file) => ({ ...file }));
}
