import { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { SupabaseDataProvider } from './supabase-data-provider';

// Minimal chainable stand-in for Supabase's PostgrestFilterBuilder: every
// method returns the same object, which resolves like the real builder does.
function fakeClient(result: {
  data: unknown;
  error: PostgrestError | null;
  count?: number | null;
}) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
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
    expect(builder.order).toHaveBeenCalledWith('name', { ascending: true });
    expect(builder.range).toHaveBeenCalledWith(5, 9);
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

  it('normalizes a Postgrest error into a plain Error', async () => {
    const error = {
      message: 'boom',
      details: '',
      hint: '',
      code: '500',
    } as PostgrestError;
    const { client } = fakeClient({ data: null, error });
    const provider = new SupabaseDataProvider(client);

    await expect(provider.getOne('users', { id: '1' })).rejects.toThrow('boom');
  });
});
