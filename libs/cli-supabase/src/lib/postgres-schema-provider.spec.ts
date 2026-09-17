import { createPostgresSchemaProvider } from './postgres-schema-provider';
import { PostgresConnection } from './supabase-connection';

const connect = vi.fn().mockResolvedValue(undefined);
const end = vi.fn().mockResolvedValue(undefined);
const query = vi.fn();

vi.mock('pg', () => ({
  Client: vi.fn().mockImplementation(function () {
    return { connect, end, query };
  }),
}));

const connection: PostgresConnection = {
  strategy: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
};

describe('createPostgresSchemaProvider', () => {
  beforeEach(() => {
    connect.mockClear();
    end.mockClear();
    query.mockClear();
  });

  it('lists tables from information_schema.tables', async () => {
    query.mockResolvedValueOnce({
      rows: [{ table_name: 'orders' }, { table_name: 'products' }],
    });

    const provider = createPostgresSchemaProvider(connection);
    const tables = await provider.listTables();

    expect(tables).toEqual(['orders', 'products']);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('information_schema.tables');
  });

  it('introspects a table into typed fields', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { column_name: 'id', data_type: 'bigint' },
        { column_name: 'name', data_type: 'text' },
        { column_name: 'in_stock', data_type: 'boolean' },
        { column_name: 'created_at', data_type: 'timestamp with time zone' },
      ],
    });

    const provider = createPostgresSchemaProvider(connection);
    const fields = await provider.introspectTable('products');

    expect(fields).toEqual([
      { name: 'id', type: 'number' },
      { name: 'name', type: 'text' },
      { name: 'in_stock', type: 'boolean' },
      { name: 'created_at', type: 'date' },
    ]);
    expect(query.mock.calls[0][0]).toContain('information_schema.columns');
    expect(query.mock.calls[0][1]).toEqual(['products']);
  });

  it('closes the client even if the query fails', async () => {
    query.mockRejectedValueOnce(new Error('connection lost'));

    const provider = createPostgresSchemaProvider(connection);
    await expect(provider.listTables()).rejects.toThrow('connection lost');
    expect(end).toHaveBeenCalledTimes(1);
  });
});
