import { Route } from '@angular/router';

import { HomePage } from './home-page';
import { NotFoundPage } from './pages/not-found-page';
import { resourceRoutes } from './resource-routes';
import { SettingsPage } from './settings-page';
import { SignInPage } from './sign-in-page';

export const appRoutes: Route[] = [
  { path: '', component: HomePage },
  { path: 'sign-in', component: SignInPage },
  ...resourceRoutes,
  { path: 'settings', component: SettingsPage },
  { path: '**', component: NotFoundPage },
];
