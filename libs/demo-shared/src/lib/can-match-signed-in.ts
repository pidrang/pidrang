import { inject } from '@angular/core';
import { CanMatchFn, RedirectCommand } from '@angular/router';
import { AUTH_PROVIDER } from '@pidrang/core';

import { injectSignInUrl } from './sign-in-url';

export function canMatchSignedIn(resources: readonly string[]): CanMatchFn {
  return async (_route, segments) => {
    const authProvider = inject(AUTH_PROVIDER, { optional: true });
    const signIn = injectSignInUrl();
    const name = segments[0]?.path;
    if (
      authProvider === null ||
      signIn === null ||
      name === undefined ||
      !resources.includes(name)
    ) {
      return true;
    }
    let identity;
    try {
      identity = await authProvider.getIdentity();
    } catch {
      return true;
    }
    return identity !== null || new RedirectCommand(signIn);
  };
}
