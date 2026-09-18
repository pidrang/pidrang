import { isAuthRequiredError } from './auth-required-error';

describe('isAuthRequiredError', () => {
  it('recognizes a Postgrest row-level security message', () => {
    expect(
      isAuthRequiredError(
        new Error(
          'new row violates row-level security policy for table "products"',
        ),
      ),
    ).toBe(true);
  });

  it('recognizes a Postgrest missing-GRANT message', () => {
    expect(
      isAuthRequiredError(new Error('permission denied for table products')),
    ).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isAuthRequiredError(new Error('Network error'))).toBe(false);
  });

  it('handles a non-Error thrown value', () => {
    expect(isAuthRequiredError('row-level security violation')).toBe(true);
  });
});
