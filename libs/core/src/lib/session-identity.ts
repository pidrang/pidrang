import { InjectionToken, WritableSignal, signal } from '@angular/core';

import { AuthIdentity } from './auth-provider';

export const SESSION_IDENTITY = new InjectionToken<
  WritableSignal<AuthIdentity | null>
>('pidrang.session-identity', {
  factory: () => signal<AuthIdentity | null>(null),
});
