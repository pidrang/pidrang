import { Field } from '@pidrang/core';
import { CrudAction, GenerationPlan } from '@pidrang/cli';
import { entryRedirect } from './entry-redirect';

const FIELDS: Field[] = [{ name: 'id', type: 'number' }];

function plan(...tables: [string, CrudAction[]][]): GenerationPlan {
  return {
    providerId: 'fake',
    tables: tables.map(([table, actions]) => ({
      table,
      actions,
      fields: FIELDS,
      hiddenFields: [],
    })),
  };
}

describe('entryRedirect', () => {
  it('opens the list of the first table that has one', () => {
    expect(entryRedirect(plan(['products', ['list', 'show']]))).toBe(
      '/products',
    );
  });

  it('skips a table without a list', () => {
    expect(
      entryRedirect(plan(['orders', ['show', 'edit']], ['products', ['list']])),
    ).toBe('/products');
  });

  it('opens the create page of the first table without a list', () => {
    expect(
      entryRedirect(plan(['orders', ['show']], ['products', ['create']])),
    ).toBe('/products/create');
  });

  it('prefers a later list to an earlier create page', () => {
    expect(
      entryRedirect(plan(['users', ['create', 'show']], ['orders', ['list']])),
    ).toBe('/orders');
  });

  it('prefers the list of a table that has both', () => {
    expect(entryRedirect(plan(['products', ['create', 'list']]))).toBe(
      '/products',
    );
  });

  it('encodes the table name as one URL segment', () => {
    expect(entryRedirect(plan(['order items', ['list']]))).toBe(
      '/order%20items',
    );
  });

  it('has no redirect when no table can be opened', () => {
    expect(entryRedirect(plan(['orders', ['delete']]))).toBeNull();
    expect(entryRedirect(plan())).toBeNull();
  });
});
