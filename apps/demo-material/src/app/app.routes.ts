import { Route } from '@angular/router';
import { demoRoutes } from '@pidrang/demo-shared';

import { HomePage } from './pages/home-page';
import { NotFoundPage } from './pages/not-found-page';
import { ResourceCreatePage } from './pages/resource-create-page';
import { ResourceEditPage } from './pages/resource-edit-page';
import { ResourceListPage } from './pages/resource-list-page';
import { ResourceShowPage } from './pages/resource-show-page';
import { SignInPage } from './pages/sign-in-page';

export const appRoutes: Route[] = demoRoutes({
  home: HomePage,
  signIn: SignInPage,
  notFound: NotFoundPage,
  list: ResourceListPage,
  create: ResourceCreatePage,
  show: ResourceShowPage,
  edit: ResourceEditPage,
});
