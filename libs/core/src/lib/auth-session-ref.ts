import { Signal } from '@angular/core';

import { AuthIdentity } from './auth-provider';

export interface AuthSessionRef {
  readonly value: Signal<AuthIdentity | null | undefined>;
  readonly error: Signal<Error | undefined>;
  readonly isLoading: Signal<boolean>;
  reload(): void;
}
