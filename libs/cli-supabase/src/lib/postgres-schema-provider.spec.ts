import { createPostgresSchemaProvider } from './postgres-schema-provider';
import { PostgresConnection } from './supabase-connection';

const connect = vi.fn().mockResolvedValue(undefined);
const end = vi.fn().mockResolvedValue(undefined);
const query = vi.fn();
const ClientConstructor = vi.fn();

vi.mock('pg', () => ({
  Client: vi.fn().mockImplementation(function (config) {
    ClientConstructor(config);
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
    ClientConstructor.mockClear();
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
    query.mockResolvedValueOnce({ rows: [{ column_name: 'id' }] });
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
    expect(query.mock.calls[0][0]).toContain('table_constraints');
    expect(query.mock.calls[0][1]).toEqual(['products']);
    expect(query.mock.calls[1][0]).toContain('information_schema.columns');
    expect(query.mock.calls[1][1]).toEqual(['products']);
  });

  it('rejects a table with no primary key before it gets introspected further', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const provider = createPostgresSchemaProvider(connection);

    await expect(provider.introspectTable('logs')).rejects.toThrow(
      'Table "logs" has no primary key',
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects a table with a composite primary key before it gets introspected further', async () => {
    query.mockResolvedValueOnce({
      rows: [{ column_name: 'order_id' }, { column_name: 'product_id' }],
    });

    const provider = createPostgresSchemaProvider(connection);

    await expect(provider.introspectTable('order_items')).rejects.toThrow(
      'Table "order_items" has a composite primary key (order_id, product_id)',
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('closes the client even if the query fails', async () => {
    query.mockRejectedValueOnce(new Error('connection lost'));

    const provider = createPostgresSchemaProvider(connection);
    await expect(provider.listTables()).rejects.toThrow('connection lost');
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('connects without TLS when the connection does not request it', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await createPostgresSchemaProvider(connection).listTables();

    expect(ClientConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ ssl: undefined }),
    );
  });

  it('connects with verified TLS when the connection requests it', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await createPostgresSchemaProvider({
      ...connection,
      ssl: true,
    }).listTables();

    expect(ClientConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ ssl: { rejectUnauthorized: true } }),
    );
  });

  it('connects with a custom CA, still fully verified', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await createPostgresSchemaProvider({
      ...connection,
      ssl: { ca: 'MY-CA-CERT' },
    }).listTables();

    expect(ClientConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: { rejectUnauthorized: true, ca: 'MY-CA-CERT' },
      }),
    );
  });
});
