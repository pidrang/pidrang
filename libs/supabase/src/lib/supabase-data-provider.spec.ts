import { PidrangError } from '@pidrang/core';
import { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { SupabaseDataProvider } from './supabase-data-provider';

function fakeClient(result: {
  data: unknown;
  error: PostgrestError | null;
  count?: number | null;
  status?: number;
}) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    is: vi.fn(() => builder),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => builder),
    then: (resolve: (value: unknown) => void) =>
      resolve({
        data: result.data,
        error: result.error,
        count: result.count ?? null,
        status: result.status ?? 200,
      }),
  };

  return {
    client: { from: vi.fn(() => builder) } as unknown as SupabaseClient,
    builder,
  };
}

describe('SupabaseDataProvider', () => {
  it('getList maps rows and count into a ListResult', async () => {
    const { client, builder } = fakeClient({
      data: [{ id: '1' }],
      count: 1,
      error: null,
    });
    const provider = new SupabaseDataProvider(client);

    const result = await provider.getList('users', {
      pagination: { current: 2, pageSize: 5 },
      sorters: [{ field: 'name', order: 'asc' }],
      filters: { active: true },
    });

    expect(result).toEqual({ data: [{ id: '1' }], total: 1 });
    expect(client.from).toHaveBeenCalledWith('users');
    expect(builder.eq).toHaveBeenCalledWith('active', true);
    expect(builder.order.mock.calls).toEqual([
      ['name', { ascending: true }],
      ['id', { ascending: true }],
    ]);
    expect(builder.range).toHaveBeenCalledWith(5, 9);
  });

  it('getList orders by id when no sorter is given', async () => {
    const { client, builder } = fakeClient({ data: [], count: 0, error: null });
    const provider = new SupabaseDataProvider(client);

    await provider.getList('users');

    expect(builder.order.mock.calls).toEqual([['id', { ascending: true }]]);
  });

  it('getList does not add a second id order when id is already sorted', async () => {
    const { client, builder } = fakeClient({ data: [], count: 0, error: null });
    const provider = new SupabaseDataProvider(client);

    await provider.getList('users', {
      sorters: [{ field: 'id', order: 'desc' }],
    });

    expect(builder.order.mock.calls).toEqual([['id', { ascending: false }]]);
  });

  it('getList orders deterministically and pages 23 rows across three pages', async () => {
    const { client, builder } = fakeClient({
      data: [],
      count: 23,
      error: null,
    });
    const provider = new SupabaseDataProvider(client);

    for (const current of [1, 2, 3]) {
      await provider.getList('users', {
        pagination: { current, pageSize: 10 },
        sorters: [{ field: 'id', order: 'asc' }],
      });
    }

    expect(builder.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(builder.range.mock.calls).toEqual([
      [0, 9],
      [10, 19],
      [20, 29],
    ]);
  });

  it('getList rejects malformed pagination before querying', async () => {
    const { client } = fakeClient({ data: [], count: 0, error: null });
    const provider = new SupabaseDataProvider(client);

    await expect(
      provider.getList('users', { pagination: { current: 0, pageSize: 10 } }),
    ).rejects.toThrow('Invalid pagination.current');
    await expect(
      provider.getList('users', { pagination: { current: 1, pageSize: 1.5 } }),
    ).rejects.toThrow('Invalid pagination.pageSize');
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each([
    ['eq', 'eq', 'Mouse', ['name', 'Mouse']],
    ['ne', 'neq', 'Mouse', ['name', 'Mouse']],
    ['lt', 'lt', 5, ['name', 5]],
    ['lte', 'lte', 5, ['name', 5]],
    ['gt', 'gt', 5, ['name', 5]],
    ['gte', 'gte', 5, ['name', 5]],
    ['in', 'in', ['a', 'b'], ['name', ['a', 'b']]],
    ['contains', 'ilike', 'ous', ['name', '%ous%']],
    ['contains', 'ilike', '1%_\\', ['name', '%1\\%\\_\\\\%']],
    ['null', 'is', true, ['name', null]],
    ['null', 'not', false, ['name', 'is', null]],
  ] as const)(
    'getList maps the %s filter to postgrest %s',
    async (operator, method, value, args) => {
      const { client, builder } = fakeClient({ data: [], error: null });
      const provider = new SupabaseDataProvider(client);

      await provider.getList('products', {
        filters: [{ field: 'name', operator, value }],
      });

      expect(builder[method]).toHaveBeenCalledWith(...args);
    },
  );

  it('getList keeps legacy equality records and reads a legacy null as is-null', async () => {
    const { client, builder } = fakeClient({ data: [], error: null });
    const provider = new SupabaseDataProvider(client);

    await provider.getList('products', {
      filters: { in_stock: true, note: null },
    });

    expect(builder.eq).toHaveBeenCalledWith('in_stock', true);
    expect(builder.is).toHaveBeenCalledWith('note', null);
  });

  it('getList rejects an invalid filter before querying', async () => {
    const { client } = fakeClient({ data: [], error: null });
    const provider = new SupabaseDataProvider(client);

    await expect(
      provider.getList('products', {
        filters: [{ field: 'name', operator: 'eq', value: null }],
      }),
    ).rejects.toThrow('Invalid filter');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('getList returns an empty page with the filtered total past the last row', async () => {
    const { client, builder } = fakeClient({ data: null, error: null });
    const responses = [
      {
        data: null,
        count: null,
        status: 416,
        error: {
          code: 'PGRST103',
          message: 'Requested range not satisfiable',
          details: '',
          hint: '',
        },
      },
      { data: null, count: 2, status: 200, error: null },
    ];
    builder.then = (resolve: (value: unknown) => void) =>
      resolve(responses.shift());
    const provider = new SupabaseDataProvider(client);

    const result = await provider.getList('products', {
      pagination: { current: 9, pageSize: 10 },
      filters: [{ field: 'price', operator: 'gt', value: 5 }],
    });

    expect(result).toEqual({ data: [], total: 2 });
    expect(builder.select).toHaveBeenLastCalledWith('*', {
      count: 'exact',
      head: true,
    });
    expect(builder.gt).toHaveBeenCalledTimes(2);
  });

  it('getOne returns the matching row', async () => {
    const { client } = fakeClient({ data: { id: '1' }, error: null });
    const provider = new SupabaseDataProvider(client);

    await expect(provider.getOne('users', { id: '1' })).resolves.toEqual({
      id: '1',
    });
  });

  it('create inserts and returns the created row', async () => {
    const { client, builder } = fakeClient({ data: { id: '1' }, error: null });
    const provider = new SupabaseDataProvider(client);

    await expect(
      provider.create('users', { data: { name: 'Ada' } }),
    ).resolves.toEqual({ id: '1' });
    expect(builder.insert).toHaveBeenCalledWith({ name: 'Ada' });
  });

  it('update filters by id and returns the updated row', async () => {
    const { client, builder } = fakeClient({ data: { id: '1' }, error: null });
    const provider = new SupabaseDataProvider(client);

    await expect(
      provider.update('users', { id: '1', data: { name: 'Ada' } }),
    ).resolves.toEqual({
      id: '1',
    });
    expect(builder.eq).toHaveBeenCalledWith('id', '1');
  });

  it('delete filters by id and returns the deleted row', async () => {
    const { client, builder } = fakeClient({ data: { id: '1' }, error: null });
    const provider = new SupabaseDataProvider(client);

    await expect(provider.delete('users', { id: '1' })).resolves.toEqual({
      id: '1',
    });
    expect(builder.eq).toHaveBeenCalledWith('id', '1');
  });

  it('categorizes an anonymous privilege error as unauthenticated and keeps its metadata', async () => {
    const error = {
      message: 'permission denied for table products',
      details: '',
      hint: '',
      code: '42501',
    } as PostgrestError;
    const { client } = fakeClient({ data: null, error, status: 401 });
    const provider = new SupabaseDataProvider(client);

    const failure = await provider
      .create('products', { data: { name: 'x' } })
      .catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(PidrangError);
    expect(failure).toMatchObject({
      message: 'permission denied for table products',
      category: 'unauthenticated',
      code: '42501',
      status: 401,
      cause: error,
    });
  });

  it('categorizes an authenticated row-level security denial as forbidden', async () => {
    const error = {
      message:
        'new row violates row-level security policy for table "products"',
      details: '',
      hint: '',
      code: '42501',
    } as PostgrestError;
    const { client } = fakeClient({ data: null, error, status: 403 });
    const provider = new SupabaseDataProvider(client);

    await expect(
      provider.update('products', { id: '1', data: { name: 'x' } }),
    ).rejects.toMatchObject({
      category: 'forbidden',
      status: 403,
    });
  });

  it('categorizes a missing single row as not-found', async () => {
    const error = {
      message: 'JSON object requested, multiple (or no) rows returned',
      details: '',
      hint: '',
      code: 'PGRST116',
    } as PostgrestError;
    const { client } = fakeClient({ data: null, error, status: 406 });
    const provider = new SupabaseDataProvider(client);

    await expect(
      provider.getOne('products', { id: '1' }),
    ).rejects.toMatchObject({
      category: 'not-found',
      code: 'PGRST116',
    });
  });

  it('falls back to unknown for other failures', async () => {
    const error = {
      message: 'boom',
      details: '',
      hint: '',
      code: 'XX000',
    } as PostgrestError;
    const { client } = fakeClient({ data: null, error, status: 500 });
    const provider = new SupabaseDataProvider(client);

    await expect(provider.getOne('users', { id: '1' })).rejects.toMatchObject({
      message: 'boom',
      category: 'unknown',
      status: 500,
    });
  });
});
