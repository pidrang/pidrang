import { PidrangError } from '@pidrang/core';

import { isAuthRequiredError } from './auth-required-error';

describe('isAuthRequiredError', () => {
  it('recognizes an unauthenticated failure', () => {
    expect(
      isAuthRequiredError(
        new PidrangError('permission denied for table products', {
          category: 'unauthenticated',
          status: 401,
        }),
      ),
    ).toBe(true);
  });

  it('does not ask a signed-in user to sign in again on a forbidden write', () => {
    expect(
      isAuthRequiredError(
        new PidrangError(
          'new row violates row-level security policy for table "products"',
          { category: 'forbidden', status: 403 },
        ),
      ),
    ).toBe(false);
  });

  it('ignores unstructured errors', () => {
    expect(
      isAuthRequiredError(new Error('permission denied for table products')),
    ).toBe(false);
    expect(isAuthRequiredError('row-level security violation')).toBe(false);
  });
});
