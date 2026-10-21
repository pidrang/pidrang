import { createGraphQlSchemaProvider } from './graphql-schema-provider';
import { SupabaseConnectionError } from './supabase-connection-error';
import { TableIntrospection } from '@pidrang/cli';
import { GraphQlConnection } from './supabase-connection';

function createEntries(introspection: TableIntrospection) {
  return introspection.unavailableActions.filter(
    (entry) => entry.action === 'create',
  );
}

const connection: GraphQlConnection = {
  strategy: 'graphql',
  url: 'https://example.supabase.co',
  anonKey: 'anon-key',
};

interface ColumnSpec {
  name: string;
  typeName: string;
  nullable?: boolean;
  kind?: 'SCALAR' | 'ENUM' | 'LIST';
}

function columnType(column: ColumnSpec) {
  const inner =
    column.kind === 'LIST'
      ? {
          kind: 'LIST',
          name: null,
          ofType: { kind: 'SCALAR', name: column.typeName },
        }
      : { kind: column.kind ?? 'SCALAR', name: column.typeName };
  return column.nullable
    ? inner
    : { kind: 'NON_NULL', name: null, ofType: inner };
}

function collectionField(name: string, columns: ColumnSpec[]) {
  return {
    name: `${name}Collection`,
    type: {
      kind: 'OBJECT',
      name: `${name}Connection`,
      fields: [
        {
          name: 'edges',
          type: {
            kind: 'NON_NULL',
            fields: null,
            ofType: {
              kind: 'LIST',
              fields: null,
              ofType: {
                kind: 'NON_NULL',
                fields: null,
                ofType: {
                  kind: 'OBJECT',
                  name: `${name}Edge`,
                  fields: [
                    {
                      name: 'node',
                      type: {
                        kind: 'NON_NULL',
                        fields: null,
                        ofType: {
                          kind: 'OBJECT',
                          name,
                          fields: [
                            {
                              name: 'nodeId',
                              type: {
                                kind: 'NON_NULL',
                                ofType: { kind: 'SCALAR', name: 'ID' },
                              },
                            },
                            ...columns.map((column) => ({
                              name: column.name,
                              type: columnType(column),
                            })),
                            {
                              name: 'author',
                              type: {
                                kind: 'OBJECT',
                                name: 'users',
                                ofType: null,
                              },
                            },
                            {
                              name: 'commentsCollection',
                              type: {
                                kind: 'OBJECT',
                                name: 'commentsConnection',
                                ofType: null,
                              },
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    },
  };
}

const PRODUCT_COLUMNS: ColumnSpec[] = [
  { name: 'id', typeName: 'BigInt' },
  { name: 'name', typeName: 'String' },
  { name: 'in_stock', typeName: 'Boolean' },
  { name: 'notes', typeName: 'String', nullable: true },
];

function schemaWith(...collections: ReturnType<typeof collectionField>[]) {
  return {
    data: {
      __schema: {
        queryType: {
          fields: [
            ...collections,
            { name: 'someOtherField', type: { fields: null } },
          ],
        },
      },
    },
  };
}

interface RestReply {
  status: number;
  body?: unknown;
}

interface Server {
  schema?: unknown;
  insertInput?: Record<string, string[] | null>;
  rest?: RestReply;
}

function json(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  };
}

function stubServer(server: Server = {}) {
  const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
    if (url.endsWith('/graphql/v1')) {
      const request = JSON.parse(init?.body ?? '{}') as {
        query: string;
        variables?: { name: string };
      };
      if (request.query.includes('IntrospectInputType')) {
        const name = request.variables?.name ?? '';
        const inputs = server.insertInput ?? {
          productsInsertInput: ['name', 'in_stock', 'notes'],
        };
        const inputFields = inputs[name];
        return Promise.resolve(
          json(200, {
            data: {
              __type: inputFields
                ? { inputFields: inputFields.map((field) => ({ name: field })) }
                : null,
            },
          }),
        );
      }
      return Promise.resolve(
        json(
          200,
          server.schema ??
            schemaWith(collectionField('products', PRODUCT_COLUMNS)),
        ),
      );
    }
    const reply = server.rest ?? { status: 200, body: [] };
    return Promise.resolve(json(reply.status, reply.body ?? {}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function restCalls(fetchMock: ReturnType<typeof stubServer>): string[] {
  return fetchMock.mock.calls
    .map(([url]) => url)
    .filter((url) => url.includes('/rest/v1/'));
}

describe('createGraphQlSchemaProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists tables from *Collection query fields', async () => {
    stubServer();
    const provider = createGraphQlSchemaProvider(connection);
    expect(await provider.listTables()).toEqual(['products']);
  });

  it('introspects a table into typed fields, excluding nodeId and relations', async () => {
    stubServer();
    const provider = createGraphQlSchemaProvider(connection);
    const introspection = await provider.introspectTable('products');
    expect(introspection.fields).toEqual([
      { name: 'id', type: 'numeric', readOnly: true },
      { name: 'name', type: 'text' },
      { name: 'in_stock', type: 'boolean' },
      { name: 'notes', type: 'text', nullable: true },
    ]);
    expect(introspection.excludedColumns).toEqual([]);
  });

  it('marks a column missing from the InsertInput type as read-only', async () => {
    stubServer({
      schema: schemaWith(
        collectionField('items', [
          { name: 'id', typeName: 'BigInt' },
          { name: 'qty', typeName: 'Int' },
          { name: 'doubled', typeName: 'Int', nullable: true },
          { name: 'seq', typeName: 'Int' },
        ]),
      ),
      insertInput: { itemsInsertInput: ['qty'] },
    });
    const { fields } =
      await createGraphQlSchemaProvider(connection).introspectTable('items');
    expect(fields).toEqual([
      { name: 'id', type: 'numeric', readOnly: true },
      { name: 'qty', type: 'number' },
      { name: 'doubled', type: 'number', readOnly: true, nullable: true },
      { name: 'seq', type: 'number', readOnly: true },
    ]);
  });

  it('makes create unavailable when a writable NOT NULL column may or may not have a default', async () => {
    stubServer();
    const { unavailableActions } =
      await createGraphQlSchemaProvider(connection).introspectTable('products');
    expect(unavailableActions).toEqual([
      {
        action: 'create',
        reason:
          'GraphQL cannot show whether "name", "in_stock" have a server default; use the direct database connection strategy to generate create',
      },
    ]);
  });

  it('counts an "id" the InsertInput accepts as a column whose default is unknown', async () => {
    stubServer({
      schema: schemaWith(
        collectionField('tags', [
          { name: 'id', typeName: 'UUID' },
          { name: 'label', typeName: 'String', nullable: true },
        ]),
      ),
      insertInput: { tagsInsertInput: ['id', 'label'] },
    });
    const { unavailableActions } =
      await createGraphQlSchemaProvider(connection).introspectTable('tags');
    expect(unavailableActions[0].reason).toContain(
      'GraphQL cannot show whether "id" has a server default',
    );
  });

  it('keeps create available when every writable column is nullable', async () => {
    stubServer({
      schema: schemaWith(
        collectionField('notes', [
          { name: 'id', typeName: 'BigInt' },
          { name: 'body', typeName: 'String', nullable: true },
          { name: 'created_at', typeName: 'Datetime' },
        ]),
      ),
      insertInput: { notesInsertInput: ['body'] },
    });
    const { unavailableActions } =
      await createGraphQlSchemaProvider(connection).introspectTable('notes');
    expect(unavailableActions).toEqual([]);
  });

  it('makes create unavailable when the key cannot see the InsertInput type', async () => {
    stubServer({ insertInput: {} });
    const introspection =
      await createGraphQlSchemaProvider(connection).introspectTable('products');
    expect(introspection.unavailableActions).toEqual([
      {
        action: 'create',
        reason:
          'GraphQL does not show which columns accept a value on insert with this key',
      },
    ]);
    expect(
      introspection.fields.filter((field) => field.readOnly).map((f) => f.name),
    ).toEqual(['id']);
  });

  it('leaves out JSON, Opaque, enum and list columns', async () => {
    stubServer({
      schema: schemaWith(
        collectionField('shapes', [
          { name: 'id', typeName: 'BigInt' },
          { name: 'meta', typeName: 'JSON', nullable: true },
          { name: 'payload', typeName: 'JSON' },
          { name: 'blob', typeName: 'Opaque', nullable: true },
          { name: 'status', typeName: 'shape_status', kind: 'ENUM' },
          { name: 'tags', typeName: 'String', kind: 'LIST', nullable: true },
        ]),
      ),
      insertInput: {
        shapesInsertInput: ['meta', 'payload', 'blob', 'status', 'tags'],
      },
    });
    const introspection =
      await createGraphQlSchemaProvider(connection).introspectTable('shapes');
    expect(introspection.fields.map((field) => field.name)).toEqual(['id']);
    expect(introspection.excludedColumns).toEqual([
      { name: 'meta', reason: 'JSON' },
      { name: 'payload', reason: 'JSON' },
      { name: 'blob', reason: 'Opaque' },
      { name: 'status', reason: 'enum shape_status' },
      { name: 'tags', reason: 'a list of String' },
    ]);
    expect(createEntries(introspection).map((entry) => entry.reason)).toEqual([
      expect.stringContaining('"payload" is left out (JSON)'),
      expect.stringContaining('"status" is left out (enum shape_status)'),
    ]);
  });

  it('checks every kept column name against the REST API with the anon key', async () => {
    const fetchMock = stubServer();
    await createGraphQlSchemaProvider(connection).introspectTable('products');
    const calls = restCalls(fetchMock);
    expect(calls).toEqual([
      `https://example.supabase.co/rest/v1/products?select=${encodeURIComponent('"id","name","in_stock","notes"')}&limit=0`,
    ]);
    const restCall = fetchMock.mock.calls.find(([url]) =>
      url.includes('/rest/v1/'),
    );
    expect(restCall?.[1]).toEqual({
      headers: { apikey: 'anon-key' },
      signal: expect.any(AbortSignal),
    });
  });

  it('accepts a table and column whose real Postgres names contain capitals', async () => {
    stubServer({
      schema: schemaWith(
        collectionField('Invoices', [
          { name: 'id', typeName: 'BigInt' },
          { name: 'Mixed', typeName: 'String', nullable: true },
        ]),
      ),
      insertInput: { InvoicesInsertInput: ['Mixed'] },
    });
    const { fields } =
      await createGraphQlSchemaProvider(connection).introspectTable('Invoices');
    expect(fields.map((field) => field.name)).toEqual(['id', 'Mixed']);
  });

  it('refuses a column pg_graphql renamed, as the REST API reports it unknown', async () => {
    stubServer({
      rest: {
        status: 400,
        body: {
          code: '42703',
          message: 'column products.otherName does not exist',
        },
      },
    });
    await expect(
      createGraphQlSchemaProvider(connection).introspectTable('products'),
    ).rejects.toThrow(
      'column products.otherName does not exist): pg_graphql may have renamed it',
    );
  });

  it('still lists a table pg_graphql renamed, and only refuses it on introspection', async () => {
    stubServer({
      schema: schemaWith(collectionField('orderItems', PRODUCT_COLUMNS)),
    });
    expect(await createGraphQlSchemaProvider(connection).listTables()).toEqual([
      'orderItems',
    ]);
  });

  it('refuses a table pg_graphql renamed, as the REST API has no such table', async () => {
    stubServer({
      schema: schemaWith(collectionField('orderItems', PRODUCT_COLUMNS)),
      rest: { status: 404, body: { code: 'PGRST205' } },
    });
    await expect(
      createGraphQlSchemaProvider(connection).introspectTable('orderItems'),
    ).rejects.toThrow(
      'GraphQL lists a table "orderItems", but the REST API the generated pages use has no table with that name',
    );
  });

  it.each([
    [401, {}],
    [403, {}],
    [400, { code: '42501' }],
  ])(
    'refuses a table whose names the anon key cannot check (%s)',
    async (status, body) => {
      stubServer({ rest: { status, body } });
      await expect(
        createGraphQlSchemaProvider(connection).introspectTable('products'),
      ).rejects.toThrow('could not check the REST names of "products"');
    },
  );

  it('reports any other REST failure without guessing', async () => {
    stubServer({ rest: { status: 500, body: { message: 'boom' } } });
    await expect(
      createGraphQlSchemaProvider(connection).introspectTable('products'),
    ).rejects.toThrow('could not check the REST names of "products": 500 boom');
  });

  it('refuses a table with no "id" column visible to GraphQL introspection', async () => {
    stubServer({
      schema: schemaWith(
        collectionField('widgets', [{ name: 'name', typeName: 'String' }]),
      ),
    });
    await expect(
      createGraphQlSchemaProvider(connection).introspectTable('widgets'),
    ).rejects.toThrow('no "id" column');
  });

  it('refuses a table name PostgREST would misread before any request', async () => {
    const fetchMock = stubServer();
    await expect(
      createGraphQlSchemaProvider(connection).introspectTable('a.b'),
    ).rejects.toThrow('cannot be scaffolded');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  async function listTablesError(status: number, body: unknown) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(status, body)));
    return createGraphQlSchemaProvider(connection)
      .listTables()
      .catch((err) => err);
  }

  it.each([
    [
      'Supabase cloud',
      200,
      { errors: [{ message: 'pg_graphql extension is not enabled.' }] },
    ],
    [
      'a local stack',
      200,
      {
        code: 'PGRST202',
        message:
          'Could not find the function public.graphql without parameters in the schema cache',
      },
    ],
  ])(
    'explains how to enable pg_graphql when %s answers without it',
    async (_where, status, body) => {
      const error = await listTablesError(status, body);
      expect(error).toBeInstanceOf(SupabaseConnectionError);
      expect(error.problem).toBe('graphql-disabled');
      expect(error.message).toContain('Database, Extensions, pg_graphql');
    },
  );

  it('throws any other GraphQL error as it is', async () => {
    const error = await listTablesError(200, {
      errors: [{ message: 'boom' }],
    });
    expect(error).not.toBeInstanceOf(SupabaseConnectionError);
    expect(error.message).toBe('Supabase GraphQL introspection failed: boom');
  });

  it.each([
    [{ message: 'Invalid API key' }],
    [{ message: 'No API key found in request' }],
  ])(
    'reports %j as a rejected key, without the anon key in the message',
    async (body) => {
      const error = await listTablesError(401, body);
      expect(error).toBeInstanceOf(SupabaseConnectionError);
      expect(error.problem).toBe('rejected-key');
      expect(error.message).toContain(
        `Supabase refused the anon key (401: ${body.message})`,
      );
      expect(error.message).not.toContain('anon-key');
    },
  );

  it('reports a project URL it cannot reach', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(
        Object.assign(new TypeError('fetch failed'), {
          cause: { code: 'ENOTFOUND' },
        }),
      ),
    );
    const error = await createGraphQlSchemaProvider(connection)
      .listTables()
      .catch((err) => err);
    expect(error).toBeInstanceOf(SupabaseConnectionError);
    expect(error.problem).toBe('unreachable-url');
    expect(error.message).toContain(
      'Could not reach https://example.supabase.co (ENOTFOUND)',
    );
  });

  it('throws when the response is not ok for another reason', async () => {
    const error = await listTablesError(500, {});
    expect(error).not.toBeInstanceOf(SupabaseConnectionError);
    expect(error.message).toMatch(/introspection failed: 500/);
  });

  it('throws when the table is not found', async () => {
    stubServer();
    await expect(
      createGraphQlSchemaProvider(connection).introspectTable('missing'),
    ).rejects.toThrow(/not found/);
  });
});
