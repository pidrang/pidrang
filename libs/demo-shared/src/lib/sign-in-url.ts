import { inject } from '@angular/core';
import { UrlTree } from '@angular/router';

import { SIGN_IN_PATH } from './sign-in-path';

export function injectSignInUrl(): UrlTree | null {
  return inject(SIGN_IN_PATH);
}
