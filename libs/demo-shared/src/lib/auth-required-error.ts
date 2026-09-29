import { PidrangError } from '@pidrang/core';

export function isAuthRequiredError(err: unknown): boolean {
  return err instanceof PidrangError && err.category === 'unauthenticated';
}
