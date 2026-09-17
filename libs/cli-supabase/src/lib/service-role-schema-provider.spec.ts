import { createServiceRoleSchemaProvider } from './service-role-schema-provider';
import { ServiceRoleConnection } from './supabase-connection';

const connection: ServiceRoleConnection = {
  strategy: 'service-role',
  url: 'https://example.supabase.co',
  serviceRoleKey: 'secret-key',
};

const openApiSchema = {
  definitions: {
    products: {
      properties: {
        id: { type: 'integer', format: 'int8' },
        name: { type: 'string', format: 'text' },
        in_stock: { type: 'boolean', format: 'bool' },
        created_at: { type: 'string', format: 'timestamptz' },
      },
    },
    orders: {
      properties: {
        id: { type: 'integer', format: 'int8' },
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
    expect(await provider.listTables()).toEqual(['products', 'orders']);
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
    expect(fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/',
      {
        headers: {
          apikey: 'secret-key',
          Authorization: 'Bearer secret-key',
        },
      },
    );
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
});
