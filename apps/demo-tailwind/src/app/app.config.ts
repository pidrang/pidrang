import { ApplicationConfig } from '@angular/core';
import { demoAppConfig } from '@pidrang/demo-shared';

import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = demoAppConfig(
  environment,
  appRoutes,
);
