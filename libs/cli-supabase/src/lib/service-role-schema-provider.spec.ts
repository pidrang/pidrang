import { createServiceRoleSchemaProvider } from './service-role-schema-provider';
import { ServiceRoleConnection } from './supabase-connection';

const connection: ServiceRoleConnection = {
  strategy: 'service-role',
  url: 'https://example.supabase.co',
  serviceRoleKey: 'secret-key',
};

const PRIMARY_KEY_DESCRIPTION = 'Note:\nThis is a Primary Key.<pk/>';

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

  it('lists tables from the OpenAPI definitions', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    expect(await provider.listTables()).toEqual([
      'products',
      'orders',
      'no_key',
      'composite_key',
      'named_key',
    ]);
  });

  it('introspects a table into typed fields', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    expect(await provider.introspectTable('products')).toEqual([
      { name: 'id', type: 'numeric', readOnly: true, hasDefault: true },
      { name: 'name', type: 'text' },
      { name: 'in_stock', type: 'boolean', hasDefault: true },
      { name: 'created_at', type: 'timestamp', hasDefault: true },
      { name: 'notes', type: 'text', nullable: true },
    ]);
  });

  it('marks a column that carries a "default" key as hasDefault, even though it is NOT NULL and so still listed in "required"', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    const fields = await provider.introspectTable('products');
    expect(fields.find((field) => field.name === 'created_at')).toEqual(
      expect.objectContaining({ hasDefault: true }),
    );
    expect(
      fields.find((field) => field.name === 'name')?.hasDefault,
    ).toBeUndefined();
  });

  it('marks a column absent from "required" as nullable', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    const fields = await provider.introspectTable('products');
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

  it('excludes definitions with no columns, such as RPC functions or columnless views', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    expect(await provider.listTables()).not.toContain('refresh_stats');
  });

  it('refuses to introspect a definition with no columns', async () => {
    const provider = createServiceRoleSchemaProvider(connection);
    await expect(provider.introspectTable('refresh_stats')).rejects.toThrow(
      'no columns',
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
