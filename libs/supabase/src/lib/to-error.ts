import { PidrangError, PidrangErrorCategory } from '@pidrang/core';

function categoryFor(
  status: number | undefined,
  code: string | undefined,
): PidrangErrorCategory {
  if (status === 401) {
    return 'unauthenticated';
  }
  if (status === 403) {
    return 'forbidden';
  }
  if (status === 404 || code === 'PGRST116') {
    return 'not-found';
  }
  return 'unknown';
}

export function toError(
  error: { message: string; code?: string; status?: number },
  status: number | undefined = error.status,
): PidrangError {
  return new PidrangError(error.message, {
    category: categoryFor(status, error.code),
    code: error.code,
    status,
    cause: error,
  });
}
