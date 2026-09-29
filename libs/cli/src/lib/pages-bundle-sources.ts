import { PagesBundleSource } from './pages-bundle-source';

const DEMO = 'apps/demo-material/src/app';

export const PAGES_BUNDLE_SOURCES: PagesBundleSource[] = [
  'auth-required-error.ts',
  'record-label.ts',
  'can-match-resource-action.ts',
  'resource-unavailable-path.ts',
  'pages/not-found-page.ts',
  'pages/resource-list-page.ts',
  'pages/resource-create-page.ts',
  'pages/resource-show-page.ts',
  'pages/resource-edit-page.ts',
].map((file) => ({ target: `src/app/${file}`, source: `${DEMO}/${file}` }));
