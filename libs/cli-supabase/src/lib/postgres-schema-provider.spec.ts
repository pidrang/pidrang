import { createPostgresSchemaProvider } from './postgres-schema-provider';
import { TableIntrospection } from '@pidrang/cli';
import { PostgresConnection } from './supabase-connection';

function createEntries(introspection: TableIntrospection) {
  return introspection.unavailableActions.filter(
    (entry) => entry.action === 'create',
  );
}

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

function column(
  overrides: Partial<{
    column_name: string;
    data_type: string;
    udt_name: string;
    column_default: string | null;
    is_nullable: 'YES' | 'NO';
    is_identity: 'YES' | 'NO';
    identity_generation: 'ALWAYS' | 'BY DEFAULT' | null;
    is_generated: 'ALWAYS' | 'NEVER';
  }>,
) {
  return {
    column_name: 'column',
    data_type: 'text',
    udt_name: 'text',
    column_default: null,
    is_nullable: 'YES',
    is_identity: 'NO',
    identity_generation: null,
    is_generated: 'NEVER',
    ...overrides,
  };
}

const uuidId = column({
  column_name: 'id',
  data_type: 'uuid',
  udt_name: 'uuid',
  is_nullable: 'NO',
  column_default: 'gen_random_uuid()',
});

const BASE_TABLE = { rows: [{ table_type: 'BASE TABLE' }] };

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
    query.mockResolvedValueOnce(BASE_TABLE);
    query.mockResolvedValueOnce({ rows: [{ column_name: 'id' }] });
    query.mockResolvedValueOnce({
      rows: [
        column({
          column_name: 'id',
          data_type: 'bigint',
          udt_name: 'int8',
          is_nullable: 'NO',
          is_identity: 'YES',
          identity_generation: 'BY DEFAULT',
        }),
        column({ column_name: 'name', is_nullable: 'NO' }),
        column({ column_name: 'notes' }),
        column({
          column_name: 'created_at',
          data_type: 'timestamp with time zone',
          udt_name: 'timestamptz',
          column_default: 'now()',
          is_nullable: 'NO',
        }),
        column({
          column_name: 'search_text',
          is_nullable: 'NO',
          is_generated: 'ALWAYS',
        }),
        column({
          column_name: 'sequence_no',
          data_type: 'integer',
          udt_name: 'int4',
          is_nullable: 'NO',
          is_identity: 'YES',
          identity_generation: 'ALWAYS',
        }),
      ],
    });

    const provider = createPostgresSchemaProvider(connection);
    const introspection = await provider.introspectTable('products');

    expect(introspection).toEqual({
      fields: [
        { name: 'id', type: 'numeric', readOnly: true, hasDefault: true },
        { name: 'name', type: 'text' },
        { name: 'notes', type: 'text', nullable: true },
        {
          name: 'created_at',
          type: 'timestamp',
          readOnly: true,
          hasDefault: true,
        },
        { name: 'search_text', type: 'text', readOnly: true },
        {
          name: 'sequence_no',
          type: 'number',
          readOnly: true,
          hasDefault: true,
        },
      ],
      excludedColumns: [],
      unavailableActions: [],
    });
    expect(query.mock.calls[0][0]).toContain('information_schema.tables');
    expect(query.mock.calls[0][1]).toEqual(['products']);
    expect(query.mock.calls[1][0]).toContain('table_constraints');
    expect(query.mock.calls[1][1]).toEqual(['products']);
    expect(query.mock.calls[2][0]).toContain('information_schema.columns');
    expect(query.mock.calls[2][0]).toContain('udt_name');
    expect(query.mock.calls[2][1]).toEqual(['products']);
  });

  it('leaves out unsupported columns that can be omitted, and keeps create available', async () => {
    query.mockResolvedValueOnce(BASE_TABLE);
    query.mockResolvedValueOnce({ rows: [{ column_name: 'id' }] });
    query.mockResolvedValueOnce({
      rows: [
        uuidId,
        column({ column_name: 'meta', data_type: 'jsonb', udt_name: 'jsonb' }),
        column({
          column_name: 'settings',
          data_type: 'jsonb',
          udt_name: 'jsonb',
          is_nullable: 'NO',
          column_default: "'{}'::jsonb",
        }),
        column({
          column_name: 'tags',
          data_type: 'ARRAY',
          udt_name: '_text',
        }),
        column({
          column_name: 'status',
          data_type: 'USER-DEFINED',
          udt_name: 'order_status',
          is_nullable: 'NO',
          column_default: "'draft'::order_status",
        }),
        column({
          column_name: 'search',
          data_type: 'tsvector',
          udt_name: 'tsvector',
          is_nullable: 'NO',
          is_generated: 'ALWAYS',
        }),
        column({ column_name: 'a.b' }),
      ],
    });

    const introspection =
      await createPostgresSchemaProvider(connection).introspectTable('items');

    expect(introspection.fields.map((field) => field.name)).toEqual(['id']);
    expect(introspection.excludedColumns).toEqual([
      { name: 'meta', reason: 'jsonb' },
      { name: 'settings', reason: 'jsonb' },
      { name: 'tags', reason: 'text[]' },
      { name: 'status', reason: 'order_status' },
      { name: 'search', reason: 'tsvector' },
      {
        name: 'a.b',
        reason: 'a name PostgREST would read as a path, a list or a quote',
      },
    ]);
    expect(createEntries(introspection)).toEqual([]);
    expect(introspection.unavailableActions).toEqual([
      {
        action: 'edit',
        reason: 'no column of this table can be edited in a generated form',
      },
    ]);
  });

  it('makes create unavailable when a left-out column is NOT NULL with no default', async () => {
    query.mockResolvedValueOnce(BASE_TABLE);
    query.mockResolvedValueOnce({ rows: [{ column_name: 'id' }] });
    query.mockResolvedValueOnce({
      rows: [
        uuidId,
        column({
          column_name: 'payload',
          data_type: 'jsonb',
          udt_name: 'jsonb',
          is_nullable: 'NO',
        }),
      ],
    });

    const introspection =
      await createPostgresSchemaProvider(connection).introspectTable('events');

    expect(createEntries(introspection)).toEqual([
      {
        action: 'create',
        reason: expect.stringContaining('"payload" is left out (jsonb)'),
      },
    ]);
  });

  it.each([
    ['a uuid id with a default', { column_default: 'gen_random_uuid()' }],
    [
      'an identity id',
      { is_identity: 'YES', identity_generation: 'ALWAYS' as const },
    ],
    [
      'a by-default identity id',
      { is_identity: 'YES', identity_generation: 'BY DEFAULT' as const },
    ],
  ])('keeps create available for %s', async (_, idFlags) => {
    query.mockResolvedValueOnce(BASE_TABLE);
    query.mockResolvedValueOnce({ rows: [{ column_name: 'id' }] });
    query.mockResolvedValueOnce({
      rows: [column({ column_name: 'id', is_nullable: 'NO', ...idFlags })],
    });

    const introspection =
      await createPostgresSchemaProvider(connection).introspectTable('items');

    expect(createEntries(introspection)).toEqual([]);
  });

  it('makes create unavailable when "id" has no server default, since the form never asks for it', async () => {
    query.mockResolvedValueOnce(BASE_TABLE);
    query.mockResolvedValueOnce({ rows: [{ column_name: 'id' }] });
    query.mockResolvedValueOnce({
      rows: [column({ column_name: 'id', is_nullable: 'NO' })],
    });

    const introspection =
      await createPostgresSchemaProvider(connection).introspectTable('codes');

    expect(createEntries(introspection)).toEqual([
      {
        action: 'create',
        reason:
          '"id" has no server default and the create form never asks for it',
      },
    ]);
  });

  it('refuses an "id" column of an unsupported type', async () => {
    query.mockResolvedValueOnce(BASE_TABLE);
    query.mockResolvedValueOnce({ rows: [{ column_name: 'id' }] });
    query.mockResolvedValueOnce({
      rows: [
        column({
          column_name: 'id',
          data_type: 'jsonb',
          udt_name: 'jsonb',
          is_nullable: 'NO',
        }),
      ],
    });

    await expect(
      createPostgresSchemaProvider(connection).introspectTable('odd'),
    ).rejects.toThrow('has an "id" column pidrang cannot use (jsonb)');
  });

  it.each([
    ['a view', { rows: [{ table_type: 'VIEW' }] }],
    ['a missing table or a function', { rows: [] }],
  ])('refuses %s before reading its primary key', async (_, relation) => {
    query.mockResolvedValueOnce(relation);

    await expect(
      createPostgresSchemaProvider(connection).introspectTable('things'),
    ).rejects.toThrow('"things" is not a table in the public schema');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each(['a.b', 'a,b', 'f(x)', 'say"hi', 'a->b'])(
    'refuses the table name %s before connecting',
    async (table) => {
      await expect(
        createPostgresSchemaProvider(connection).introspectTable(table),
      ).rejects.toThrow('cannot be scaffolded');
      expect(ClientConstructor).not.toHaveBeenCalled();
    },
  );

  it('rejects a table with no primary key before it gets introspected further', async () => {
    query.mockResolvedValueOnce(BASE_TABLE);
    query.mockResolvedValueOnce({ rows: [] });

    const provider = createPostgresSchemaProvider(connection);

    await expect(provider.introspectTable('logs')).rejects.toThrow(
      'Table "logs" has no primary key',
    );
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('rejects a table with a composite primary key before it gets introspected further', async () => {
    query.mockResolvedValueOnce(BASE_TABLE);
    query.mockResolvedValueOnce({
      rows: [{ column_name: 'order_id' }, { column_name: 'product_id' }],
    });

    const provider = createPostgresSchemaProvider(connection);

    await expect(provider.introspectTable('order_items')).rejects.toThrow(
      'Table "order_items" has a composite primary key (order_id, product_id)',
    );
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('rejects a single-column primary key not named "id"', async () => {
    query.mockResolvedValueOnce(BASE_TABLE);
    query.mockResolvedValueOnce({ rows: [{ column_name: 'code' }] });

    const provider = createPostgresSchemaProvider(connection);

    await expect(provider.introspectTable('products')).rejects.toThrow(
      'Table "products" has a primary key named "code", not "id"',
    );
    expect(query).toHaveBeenCalledTimes(2);
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

  describe('readsNeedSignIn', () => {
    async function readsNeedSignIn(row: unknown): Promise<boolean | null> {
      query.mockResolvedValueOnce({ rows: row === undefined ? [] : [row] });
      return createPostgresSchemaProvider(connection).readsNeedSignIn!(
        'products',
      );
    }

    it('reads the policies of the table from the catalog', async () => {
      await readsNeedSignIn({
        row_security: true,
        restrictive_policies: '0',
        unconditional_policies: '1',
      });

      const [sql, values] = query.mock.calls[0];
      expect(sql).toContain('pg_class');
      expect(sql).toContain('pg_policy');
      expect(sql).toContain("r.rolname = 'anon'");
      expect(values).toEqual(['products']);
      expect(end).toHaveBeenCalledTimes(1);
    });

    it('needs no signed-in user when the table has no row level security', async () => {
      expect(
        await readsNeedSignIn({
          row_security: false,
          restrictive_policies: '0',
          unconditional_policies: '0',
        }),
      ).toBe(false);
    });

    it('needs a signed-in user when no policy lets anon read the table', async () => {
      expect(
        await readsNeedSignIn({
          row_security: true,
          restrictive_policies: '0',
          unconditional_policies: '0',
        }),
      ).toBe(true);
    });

    it('needs no signed-in user when an unconditional policy lets anon read', async () => {
      expect(
        await readsNeedSignIn({
          row_security: true,
          restrictive_policies: '0',
          unconditional_policies: '1',
        }),
      ).toBe(false);
    });

    it('needs a signed-in user when a restrictive policy narrows anon reads', async () => {
      expect(
        await readsNeedSignIn({
          row_security: true,
          restrictive_policies: '1',
          unconditional_policies: '1',
        }),
      ).toBe(true);
    });

    it('cannot tell when the table is not in the catalog', async () => {
      expect(await readsNeedSignIn(undefined)).toBeNull();
    });

    it('refuses a table name PostgREST cannot expose', async () => {
      await expect(
        createPostgresSchemaProvider(connection).readsNeedSignIn!('a.b'),
      ).rejects.toThrow('Table "a.b" cannot be scaffolded');
      expect(query).not.toHaveBeenCalled();
    });
  });
});
