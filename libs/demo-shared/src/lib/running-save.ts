import { WritableSignal } from '@angular/core';

import { SaveOutcome } from './save-outcome';
import { SaveTimeoutError } from './save-timeout-error';

export interface RunningSave {
  outcome: WritableSignal<SaveOutcome | null>;
  timeout: WritableSignal<SaveTimeoutError | null>;
  session: number;
}
