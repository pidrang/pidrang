import { Filter, PidrangError } from '@pidrang/core';
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
    is: vi.fn(() => builder),
    not: vi.fn(() => builder),
    filter: vi.fn(() => builder),
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

  it.each<{
    filter: Filter;
    method: keyof ReturnType<typeof fakeClient>['builder'];
    args: unknown[];
  }>([
    {
      filter: { field: 'name', operator: 'eq', value: 'Mouse' },
      method: 'eq',
      args: ['name', 'Mouse'],
    },
    {
      filter: { field: 'name', operator: 'ne', value: 'Mouse' },
      method: 'neq',
      args: ['name', 'Mouse'],
    },
    {
      filter: { field: 'name', operator: 'lt', value: 5 },
      method: 'lt',
      args: ['name', 5],
    },
    {
      filter: { field: 'name', operator: 'lte', value: 5 },
      method: 'lte',
      args: ['name', 5],
    },
    {
      filter: { field: 'name', operator: 'gt', value: 5 },
      method: 'gt',
      args: ['name', 5],
    },
    {
      filter: { field: 'name', operator: 'gte', value: 5 },
      method: 'gte',
      args: ['name', 5],
    },
    {
      filter: { field: 'name', operator: 'in', value: ['a', 'b'] },
      method: 'filter',
      args: ['name', 'in', '("a","b")'],
    },
    {
      filter: { field: 'name', operator: 'in', value: ['a,"b"\\c', 3] },
      method: 'filter',
      args: ['name', 'in', '("a,\\"b\\"\\\\c","3")'],
    },
    {
      filter: { field: 'name', operator: 'contains', value: 'ous' },
      method: 'filter',
      args: ['name', 'imatch', 'ous'],
    },
    {
      filter: { field: 'name', operator: 'contains', value: 'a*.(b)%_' },
      method: 'filter',
      args: ['name', 'imatch', 'a\\*\\.\\(b\\)%_'],
    },
    {
      filter: { field: 'name', operator: 'contains', value: 'C:\\d' },
      method: 'filter',
      args: ['name', 'imatch', 'C:\\\\d'],
    },
    {
      filter: { field: 'name', operator: 'null', value: true },
      method: 'is',
      args: ['name', null],
    },
    {
      filter: { field: 'name', operator: 'null', value: false },
      method: 'not',
      args: ['name', 'is', null],
    },
  ])(
    'getList maps the $filter.operator filter to postgrest $method',
    async ({ filter, method, args }) => {
      const { client, builder } = fakeClient({ data: [], error: null });
      const provider = new SupabaseDataProvider(client);

      await provider.getList('products', { filters: [filter] });

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
        filters: [
          { field: 'name', operator: 'eq', value: null } as unknown as Filter,
        ],
      }),
    ).rejects.toThrow('Invalid filter');
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each([
    'select',
    'columns',
    'order',
    'limit',
    'offset',
    'on_conflict',
    'or',
    'and',
    'items.limit',
    'a,b',
    'count(id)',
    'data->name',
  ])(
    'getList rejects the filter field %s, which PostgREST would not read as a column',
    async (field) => {
      const { client } = fakeClient({ data: [], error: null });
      const provider = new SupabaseDataProvider(client);

      await expect(
        provider.getList('products', {
          filters: [{ field, operator: 'eq', value: 'x' }],
        }),
      ).rejects.toThrow(`Invalid field "${field}"`);
      await expect(
        provider.getList('products', { filters: { [field]: 'x' } }),
      ).rejects.toThrow(`Invalid field "${field}"`);
      expect(client.from).not.toHaveBeenCalled();
    },
  );

  it.each(['name.desc', 'name,id'])(
    'getList rejects the sorter field %s before querying',
    async (field) => {
      const { client } = fakeClient({ data: [], error: null });
      const provider = new SupabaseDataProvider(client);

      await expect(
        provider.getList('products', { sorters: [{ field, order: 'asc' }] }),
      ).rejects.toThrow(`Invalid field "${field}"`);
      expect(client.from).not.toHaveBeenCalled();
    },
  );

  it('getList sorts on columns named like PostgREST query options', async () => {
    const { client, builder } = fakeClient({ data: [], count: 0, error: null });
    const provider = new SupabaseDataProvider(client);

    await provider.getList('products', {
      sorters: [
        { field: 'order', order: 'asc' },
        { field: 'limit', order: 'desc' },
      ],
    });

    expect(builder.order).toHaveBeenCalledWith('order', { ascending: true });
    expect(builder.order).toHaveBeenCalledWith('limit', { ascending: false });
  });

  it('getList reports a failed count past the last row with a message', async () => {
    const { client, builder } = fakeClient({ data: null, error: null });
    const responses = [
      {
        data: null,
        error: { message: 'Range not satisfiable', code: 'PGRST103' },
        count: null,
        status: 416,
      },
      { data: null, error: { message: '' }, count: null, status: 401 },
    ];
    builder.then = (resolve: (value: unknown) => void) =>
      resolve(responses.shift());
    const provider = new SupabaseDataProvider(client);

    await expect(
      provider.getList('products', { pagination: { current: 9 } }),
    ).rejects.toMatchObject({
      category: 'unauthenticated',
      message: 'Could not count the rows of products',
    });
  });

  it('getList accepts a column name with spaces or capitals', async () => {
    const { client, builder } = fakeClient({ data: [], count: 0, error: null });
    const provider = new SupabaseDataProvider(client);

    await provider.getList('products', {
      filters: [{ field: 'Unit price', operator: 'gte', value: 1 }],
      sorters: [{ field: 'Unit price', order: 'desc' }],
    });

    expect(builder.gte).toHaveBeenCalledWith('Unit price', 1);
    expect(builder.order).toHaveBeenCalledWith('Unit price', {
      ascending: false,
    });
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

  it('does not report an operator the column type lacks as not-found', async () => {
    const error = {
      message: 'operator does not exist: double precision ~* unknown',
      details: '',
      hint: '',
      code: '42883',
    } as PostgrestError;
    const { client } = fakeClient({ data: null, error, status: 404 });
    const provider = new SupabaseDataProvider(client);

    await expect(
      provider.getList('products', {
        filters: [{ field: 'price', operator: 'contains', value: '1' }],
      }),
    ).rejects.toMatchObject({
      category: 'unknown',
      code: '42883',
      status: 404,
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
