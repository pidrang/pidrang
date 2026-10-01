import { Provider } from '@angular/core';

import { parseSignInPath } from './parse-sign-in-path';
import { SIGN_IN_PATH } from './sign-in-path';

export function provideSignInPath(path: string): Provider {
  return { provide: SIGN_IN_PATH, useValue: parseSignInPath(path) };
}
