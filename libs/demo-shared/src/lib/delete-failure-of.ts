import { PidrangError } from '@pidrang/core';

import { DeleteFailure } from './delete-failure';

export function deleteFailureOf(error: unknown): DeleteFailure {
  return {
    message: error instanceof Error ? error.message : String(error),
    category: error instanceof PidrangError ? error.category : 'unknown',
  };
}
