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
      properties: {
        id: {
          type: 'integer',
          format: 'int8',
          description: PRIMARY_KEY_DESCRIPTION,
        },
        name: { type: 'string', format: 'text' },
        in_stock: { type: 'boolean', format: 'bool' },
        created_at: { type: 'string', format: 'timestamptz' },
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
      { name: 'id', type: 'number' },
      { name: 'name', type: 'text' },
      { name: 'in_stock', type: 'boolean' },
      { name: 'created_at', type: 'date' },
    ]);
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
