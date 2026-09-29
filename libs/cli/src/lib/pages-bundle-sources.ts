import { PagesBundleSource } from './pages-bundle-source';

const DEMO_PAGES = 'apps/demo-material/src/app/pages';
const DEMO_SHARED = 'libs/demo-shared/src/lib';

export const PAGES_BUNDLE_SOURCES: PagesBundleSource[] = [
  ...[
    'auth-required-error.ts',
    'can-match-resource-action.ts',
    'record-label.ts',
    'resource-unavailable-path.ts',
  ].map((file) => ({
    target: `src/app/pidrang/${file}`,
    source: `${DEMO_SHARED}/${file}`,
  })),
  ...[
    'not-found-page.ts',
    'resource-list-page.ts',
    'resource-create-page.ts',
    'resource-show-page.ts',
    'resource-edit-page.ts',
  ].map((file) => ({
    target: `src/app/pages/${file}`,
    source: `${DEMO_PAGES}/${file}`,
  })),
];
