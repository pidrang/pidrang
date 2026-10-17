import { createServiceRoleSchemaProvider } from './service-role-schema-provider';
import { TableIntrospection } from '@pidrang/cli';
import { ServiceRoleConnection } from './supabase-connection';

function createEntries(introspection: TableIntrospection) {
  return introspection.unavailableActions.filter(
    (entry) => entry.action === 'create',
  );
}

const connection: ServiceRoleConnection = {
  strategy: 'service-role',
  url: 'https://example.supabase.co',
  serviceRoleKey: 'secret-key',
};

const PRIMARY_KEY_DESCRIPTION = 'Note:\nThis is a Primary Key.<pk/>';

const ALL_METHODS = { get: {}, post: {}, patch: {}, delete: {} };

const openApiSchema = {
  definitions: {
    products: {
      required: ['id', 'name', 'in_stock', 'created_at'],
      properties: {
        id: {
          type: 'integer',
          format: 'int8',
          description: PRIMARY_KEY_DESCRIPTION,
          default: 'gen_random_uuid()',
        },
        name: { type: 'string', format: 'text' },
        in_stock: { type: 'boolean', format: 'bool', default: true },
        created_at: {
          type: 'string',
          format: 'timestamptz',
          default: 'now()',
        },
        notes: { type: 'string', format: 'text' },
      },
    },
    orders: {
      properties: {
        id: {
          type: 'integer',
          format: 'int8',
          description: PRIMARY_KEY_DESCRIPTION,
        },
      },
    },
    refresh_stats: {
      properties: {},
    },
    no_key: {
      properties: {
        name: { type: 'string', format: 'text' },
      },
    },
    composite_key: {
      properties: {
        a: {
          type: 'string',
          format: 'text',
          description: PRIMARY_KEY_DESCRIPTION,
        },
        b: {
          type: 'string',
          format: 'text',
          description: PRIMARY_KEY_DESCRIPTION,
        },
      },
    },
    named_key: {
      properties: {
        code: {
          type: 'string',
          format: 'text',
          description: PRIMARY_KEY_DESCRIPTION,
        },
        name: { type: 'string', format: 'text' },
      },
    },
    totals_view: {
      required: ['id'],
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: PRIMARY_KEY_DESCRIPTION,
        },
        total: { type: 'integer', format: 'bigint' },
      },
    },
    shapes: {
      required: ['id', 'payload', 'settings', 'status'],
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: PRIMARY_KEY_DESCRIPTION,
          default: 'gen_random_uuid()',
        },
        payload: { format: 'jsonb' },
        settings: { format: 'jsonb' },
        meta: { format: 'jsonb' },
        tags: { type: 'array', format: 'text[]', items: { type: 'string' } },
        status: {
          type: 'string',
          format: 'public.order_status',
          enum: ['draft', 'live'],
          default: 'draft',
        },
        'a.b': { type: 'string', format: 'text' },
      },
    },
    counters: {
      required: ['id', 'quantity'],
      properties: {
        id: {
          type: 'integer',
          format: 'int64',
          description: PRIMARY_KEY_DESCRIPTION,
        },
        quantity: { type: 'integer', format: 'int32', default: 1 },
        rank: { type: 'integer', format: 'int32' },
      },
    },
    unserved: {
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: PRIMARY_KEY_DESCRIPTION,
        },
      },
    },
  },
  paths: {
    '/': { get: {} },
    '/products': ALL_METHODS,
    '/orders': ALL_METHODS,
    '/refresh_stats': ALL_METHODS,
    '/no_key': ALL_METHODS,
    '/composite_key': ALL_METHODS,
    '/named_key': ALL_METHODS,
    '/totals_view': { get: {} },
    '/shapes': ALL_METHODS,
    '/counters': ALL_METHODS,
    '/rpc/refresh_stats': { get: {}, post: {} },
  },
};

describe('createServiceRoleSchemaProvider', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(openApiSchema),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the OpenAPI definitions PostgREST serves with GET', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    expect(await provider.listTables()).toEqual([
      'products',
      'orders',
      'no_key',
      'composite_key',
      'named_key',
      'totals_view',
      'shapes',
      'counters',
    ]);
  });

  it('introspects a table into typed fields', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    expect(await provider.introspectTable('products')).toEqual({
      fields: [
        { name: 'id', type: 'numeric', readOnly: true, hasDefault: true },
        { name: 'name', type: 'text' },
        { name: 'in_stock', type: 'boolean', hasDefault: true },
        { name: 'created_at', type: 'timestamp', hasDefault: true },
        { name: 'notes', type: 'text', nullable: true },
      ],
      excludedColumns: [],
      unavailableActions: [],
    });
  });

  it('introspects the integer formats of PostgREST 16 without losing a column', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    expect(await provider.introspectTable('counters')).toEqual({
      fields: [
        { name: 'id', type: 'numeric', readOnly: true },
        { name: 'quantity', type: 'number', hasDefault: true },
        { name: 'rank', type: 'number', nullable: true },
      ],
      excludedColumns: [],
      unavailableActions: [],
    });
  });

  it('makes every write unavailable on a view PostgREST only serves with GET', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    const introspection = await provider.introspectTable('totals_view');
    expect(
      introspection.unavailableActions.map((entry) => entry.action),
    ).toEqual(['create', 'edit', 'delete']);
    expect(introspection.unavailableActions[0].reason).toContain(
      'PostgREST does not accept POST on "totals_view"',
    );
  });

  it.each([
    ['create', 'post'],
    ['edit', 'patch'],
    ['delete', 'delete'],
  ])(
    'makes only %s unavailable when the %s method is missing',
    async (action, method) => {
      const methods: Record<string, object> = { ...ALL_METHODS };
      delete methods[method];
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              ...openApiSchema,
              paths: { ...openApiSchema.paths, '/products': methods },
            }),
        }),
      );
      const introspection =
        await createServiceRoleSchemaProvider(connection).introspectTable(
          'products',
        );
      expect(
        introspection.unavailableActions.map((entry) => entry.action),
      ).toEqual([action]);
    },
  );

  it('leaves out unsupported columns and makes create unavailable for a NOT NULL one with no visible default', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    const introspection = await provider.introspectTable('shapes');
    expect(introspection.fields.map((field) => field.name)).toEqual(['id']);
    expect(introspection.excludedColumns).toEqual([
      { name: 'payload', reason: 'jsonb' },
      { name: 'settings', reason: 'jsonb' },
      { name: 'meta', reason: 'jsonb' },
      { name: 'tags', reason: 'text[]' },
      { name: 'status', reason: 'enum public.order_status' },
      {
        name: 'a.b',
        reason: 'a name PostgREST would read as a path, a list or a quote',
      },
    ]);
    expect(createEntries(introspection)).toEqual([
      {
        action: 'create',
        reason: expect.stringContaining('"payload" is left out (jsonb)'),
      },
      {
        action: 'create',
        reason: expect.stringContaining('"settings" is left out (jsonb)'),
      },
    ]);
  });

  it('refuses a definition PostgREST does not serve as a table path', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    expect(await provider.listTables()).not.toContain('unserved');
    await expect(provider.introspectTable('unserved')).rejects.toThrow(
      'is not a table or view PostgREST serves',
    );
  });

  it('refuses a table name PostgREST would misread before fetching', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    await expect(provider.introspectTable('a.b')).rejects.toThrow(
      'cannot be scaffolded',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never puts the service role key in an error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }),
    );
    const error = await createServiceRoleSchemaProvider(connection)
      .listTables()
      .catch((err) => err);
    expect(error.message).not.toContain('secret-key');
  });

  it('marks a column that carries a "default" key as hasDefault, even though it is NOT NULL and so still listed in "required"', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    const { fields } = await provider.introspectTable('products');
    expect(fields.find((field) => field.name === 'created_at')).toEqual(
      expect.objectContaining({ hasDefault: true }),
    );
    expect(
      fields.find((field) => field.name === 'name')?.hasDefault,
    ).toBeUndefined();
  });

  it('marks a column absent from "required" as nullable', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    const { fields } = await provider.introspectTable('products');
    expect(fields.find((field) => field.name === 'notes')).toEqual(
      expect.objectContaining({ nullable: true }),
    );
    expect(
      fields.find((field) => field.name === 'name')?.nullable,
    ).toBeUndefined();
  });

  it('calls the OpenAPI endpoint with the service role key', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    await provider.listTables();
    expect(fetch).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/', {
      headers: {
        apikey: 'secret-key',
        Authorization: 'Bearer secret-key',
      },
    });
  });

  it('throws when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }),
    );
    const provider = createServiceRoleSchemaProvider(connection);
    await expect(provider.listTables()).rejects.toThrow(/401/);
  });

  it('excludes definitions with no columns, such as columnless views', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    expect(await provider.listTables()).not.toContain('refresh_stats');
  });

  it('refuses to introspect a definition with no columns', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    await expect(provider.introspectTable('refresh_stats')).rejects.toThrow(
      'is not a table or view PostgREST serves with columns',
    );
  });

  it('refuses to introspect a table with no primary key', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    await expect(provider.introspectTable('no_key')).rejects.toThrow(
      'Table "no_key" has no primary key',
    );
  });

  it('refuses to introspect a table with a composite primary key', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    await expect(provider.introspectTable('composite_key')).rejects.toThrow(
      'Table "composite_key" has a composite primary key (a, b)',
    );
  });

  it('refuses to introspect a single-column primary key not named "id"', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    await expect(provider.introspectTable('named_key')).rejects.toThrow(
      'Table "named_key" has a primary key named "code", not "id"',
    );
  });
});
