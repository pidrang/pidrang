import { PagesBundleSource } from './pages-bundle-source';

const DEMO_PAGES = 'apps/demo-material/src/app/pages';
const DEMO_SHARED = 'libs/demo-shared/src/lib';

export const PAGES_BUNDLE_SOURCES: PagesBundleSource[] = [
  ...[
    'auth-required-error.ts',
    'can-match-resource-action.ts',
    'delete-failure.ts',
    'delete-failure-of.ts',
    'earlier-save.ts',
    'navigation-failure.ts',
    'parse-sign-in-path.ts',
    'provide-sign-in-path.ts',
    'record-label.ts',
    'resource-create-state.ts',
    'resource-definition.ts',
    'resource-edit-state.ts',
    'resource-list-state.ts',
    'resource-record.ts',
    'resource-row.ts',
    'resource-show-state.ts',
    'resource-unavailable-path.ts',
    'running-save.ts',
    'save-failure.ts',
    'save-lock.ts',
    'save-outcome.ts',
    'save-store.ts',
    'save-timeout-error.ts',
    'sign-in-path.ts',
    'sign-in-url.ts',
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
