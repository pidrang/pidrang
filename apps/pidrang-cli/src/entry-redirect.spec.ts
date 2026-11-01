import { Field } from '@pidrang/core';
import { CrudAction, GenerationPlan } from '@pidrang/cli';
import { EntryActions } from './edit-resources';
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
    expect(entryRedirect(plan(['products', ['list', 'show']]))).toEqual({
      kind: 'redirect',
      path: '/products',
    });
  });

  it('skips a table without a list', () => {
    expect(
      entryRedirect(plan(['orders', ['show', 'edit']], ['products', ['list']])),
    ).toEqual({ kind: 'redirect', path: '/products' });
  });

  it('opens the create page of the first table without a list', () => {
    expect(
      entryRedirect(plan(['orders', ['show']], ['products', ['create']])),
    ).toEqual({ kind: 'redirect', path: '/products/create' });
  });

  it('prefers a later list to an earlier create page', () => {
    expect(
      entryRedirect(plan(['users', ['create', 'show']], ['orders', ['list']])),
    ).toEqual({ kind: 'redirect', path: '/orders' });
  });

  it('prefers the list of a table that has both', () => {
    expect(entryRedirect(plan(['products', ['create', 'list']]))).toEqual({
      kind: 'redirect',
      path: '/products',
    });
  });

  it('encodes the table name as one URL segment', () => {
    expect(entryRedirect(plan(['order items', ['list']]))).toEqual({
      kind: 'redirect',
      path: '/order%20items',
    });
  });

  it('has no redirect when no table can be opened', () => {
    expect(entryRedirect(plan(['orders', ['delete']]))).toEqual({
      kind: 'none',
    });
    expect(entryRedirect(plan())).toEqual({ kind: 'none' });
  });

  describe('with the resources the app will have', () => {
    const actions =
      (
        byTable: Record<string, EntryActions | null>,
      ): ((table: { table: string }) => EntryActions | null) =>
      (table) =>
        table.table in byTable ? byTable[table.table] : null;
    const both = plan(['products', ['list', 'create']], ['orders', ['list']]);

    it.each([
      [
        'a list kept enabled',
        { products: { list: 'enabled', create: 'enabled' } },
        { kind: 'redirect', path: '/products' },
      ],
      [
        'a list kept disabled, to the next list',
        {
          products: { list: 'disabled', create: 'enabled' },
          orders: { list: 'enabled', create: 'disabled' },
        },
        { kind: 'redirect', path: '/orders' },
      ],
      [
        'a list it cannot read, to no redirect',
        {
          products: { list: 'unknown', create: 'enabled' },
          orders: { list: 'enabled', create: 'disabled' },
        },
        { kind: 'unknown', table: 'products' },
      ],
      [
        'a table it cannot read at all, to no redirect',
        { products: null, orders: { list: 'enabled', create: 'disabled' } },
        { kind: 'unknown', table: 'products' },
      ],
      [
        'a later list it cannot read, after a list it can',
        {
          products: { list: 'enabled', create: 'enabled' },
          orders: { list: 'unknown', create: 'unknown' },
        },
        { kind: 'redirect', path: '/products' },
      ],
      [
        'every list disabled, to the first create page',
        {
          products: { list: 'disabled', create: 'enabled' },
          orders: { list: 'disabled', create: 'enabled' },
        },
        { kind: 'redirect', path: '/products/create' },
      ],
      [
        'every list disabled and a create page it cannot read, to no redirect',
        {
          products: { list: 'disabled', create: 'unknown' },
          orders: { list: 'disabled', create: 'enabled' },
        },
        { kind: 'unknown', table: 'products' },
      ],
      [
        'every list and create page disabled, to none',
        {
          products: { list: 'disabled', create: 'disabled' },
          orders: { list: 'disabled', create: 'disabled' },
        },
        { kind: 'none' },
      ],
    ] as const)('goes from %s', (_, byTable, expected) => {
      expect(
        entryRedirect(
          both,
          actions(byTable as Record<string, EntryActions | null>),
        ),
      ).toEqual(expected);
    });

    it('opens a list the kept resource enables although the answers leave it out', () => {
      expect(
        entryRedirect(
          plan(['products', ['show']]),
          actions({ products: { list: 'enabled', create: 'disabled' } }),
        ),
      ).toEqual({ kind: 'redirect', path: '/products' });
    });
  });
});
