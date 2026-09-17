import { createGraphQlSchemaProvider } from './graphql-schema-provider';
import { GraphQlConnection } from './supabase-connection';

const connection: GraphQlConnection = {
  strategy: 'graphql',
  url: 'https://example.supabase.co',
  anonKey: 'anon-key',
};

function collectionField(
  name: string,
  columns: { name: string; typeName: string }[],
) {
  return {
    name: `${name}Collection`,
    type: {
      fields: [
        {
          name: 'edges',
          type: {
            fields: [
              {
                name: 'node',
                type: {
                  fields: [
                    { name: 'nodeId', type: { name: 'ID' } },
                    ...columns.map((column) => ({
                      name: column.name,
                      type: { name: column.typeName, kind: 'SCALAR', ofType: null },
                    })),
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

const introspectionResponse = {
  data: {
    __schema: {
      queryType: {
        fields: [
          collectionField('products', [
            { name: 'id', typeName: 'BigInt' },
            { name: 'name', typeName: 'String' },
            { name: 'in_stock', typeName: 'Boolean' },
          ]),
          { name: 'someOtherField', type: { fields: null } },
        ],
      },
    },
  },
};

describe('createGraphQlSchemaProvider', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve(introspectionResponse),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists tables from *Collection query fields', async () => {
    const provider = createGraphQlSchemaProvider(connection);
    expect(await provider.listTables()).toEqual(['products']);
  });

  it('introspects a table into typed fields, excluding nodeId', async () => {
    const provider = createGraphQlSchemaProvider(connection);
    expect(await provider.introspectTable('products')).toEqual([
      { name: 'id', type: 'number' },
      { name: 'name', type: 'text' },
      { name: 'in_stock', type: 'boolean' },
    ]);
  });

  it('throws when the GraphQL response has errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            errors: [{ message: 'pg_graphql extension is not enabled.' }],
          }),
      }),
    );
    const provider = createGraphQlSchemaProvider(connection);
    await expect(provider.listTables()).rejects.toThrow(
      /pg_graphql extension is not enabled/,
    );
  });

  it('throws when the table is not found', async () => {
    const provider = createGraphQlSchemaProvider(connection);
    await expect(provider.introspectTable('missing')).rejects.toThrow(
      /not found/,
    );
  });
});
