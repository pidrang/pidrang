import { checkbox, select } from '@inquirer/prompts';
import { runInitWizard } from './wizard';
import { SchemaProvider } from './schema-provider';
import { SchemaProviderDefinition } from './schema-provider-definition';
import { TableIntrospection } from './table-introspection';

vi.mock('@inquirer/prompts', () => ({
  checkbox: vi.fn(),
  select: vi.fn(),
}));

function fakeSchemaProvider(
  introspection: Partial<TableIntrospection> = {},
): SchemaProvider {
  return {
    listTables: vi.fn().mockResolvedValue(['products', 'orders']),
    introspectTable: vi.fn().mockResolvedValue({
      fields: [
        { name: 'id', type: 'number' },
        { name: 'name', type: 'text' },
      ],
      excludedColumns: [],
      unavailableActions: [],
      ...introspection,
    }),
  };
}

function fakeDefinition(
  id: string,
  schemaProvider: SchemaProvider,
): SchemaProviderDefinition {
  return {
    id,
    label: id,
    promptConnection: vi.fn().mockResolvedValue({}),
    createSchemaProvider: vi.fn().mockReturnValue(schemaProvider),
  };
}

describe('runInitWizard', () => {
  beforeEach(() => {
    vi.mocked(checkbox).mockReset();
    vi.mocked(select).mockReset();
  });

  it('skips the provider prompt when only one provider is registered', async () => {
    const schemaProvider = fakeSchemaProvider();
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce(['list', 'create'])
      .mockResolvedValueOnce([]);

    const plan = await runInitWizard([definition]);

    expect(select).not.toHaveBeenCalled();
    expect(definition.promptConnection).toHaveBeenCalled();
    expect(plan).toEqual({
      providerId: 'supabase',
      tables: [
        {
          table: 'products',
          fields: [
            { name: 'id', type: 'number' },
            { name: 'name', type: 'text' },
          ],
          actions: ['list', 'create'],
          hiddenFields: [],
        },
      ],
    });
  });

  it('prompts for a provider when several are registered', async () => {
    const schemaProvider = fakeSchemaProvider();
    const supabase = fakeDefinition('supabase', schemaProvider);
    const rest = fakeDefinition('rest', schemaProvider);

    vi.mocked(select).mockResolvedValue('rest');
    vi.mocked(checkbox)
      .mockResolvedValueOnce(['orders'])
      .mockResolvedValueOnce(['show'])
      .mockResolvedValueOnce(['id']);

    const plan = await runInitWizard([supabase, rest]);

    expect(select).toHaveBeenCalled();
    expect(rest.promptConnection).toHaveBeenCalled();
    expect(supabase.promptConnection).not.toHaveBeenCalled();
    expect(plan.providerId).toBe('rest');
    expect(plan.tables[0].hiddenFields).toEqual(['id']);
  });

  it('refuses an empty table selection', async () => {
    const schemaProvider = fakeSchemaProvider();
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox).mockResolvedValueOnce([]);

    await expect(runInitWizard([definition])).rejects.toThrow(
      'Select at least one table',
    );
    expect(schemaProvider.introspectTable).not.toHaveBeenCalled();
  });

  it('refuses a table named after a route the generated pages reserve for themselves', async () => {
    const schemaProvider = fakeSchemaProvider();
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox).mockResolvedValueOnce(['resource-unavailable']);

    await expect(runInitWizard([definition])).rejects.toThrow(
      '"resource-unavailable" collides with a route the generated pages reserve',
    );
    expect(schemaProvider.introspectTable).not.toHaveBeenCalled();
  });

  it('plans every selected table', async () => {
    const schemaProvider = fakeSchemaProvider();
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products', 'orders'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);

    const plan = await runInitWizard([definition]);

    expect(plan.tables.map((table) => table.table)).toEqual([
      'products',
      'orders',
    ]);
    expect(schemaProvider.introspectTable).toHaveBeenCalledWith('products');
    expect(schemaProvider.introspectTable).toHaveBeenCalledWith('orders');
  });

  it.each([
    ['an empty name', ''],
    ['a blank name', '   '],
    ['a dot segment', '.'],
    ['a double dot segment', '..'],
    ['a slash', 'a/b'],
    ['a newline', 'a\nb'],
    ['a carriage return', 'a\rb'],
    ['a tab', 'a\tb'],
    ['a DEL character', 'a\u007fb'],
  ])('refuses a table with %s before introspecting it', async (_, table) => {
    const schemaProvider = fakeSchemaProvider();
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox).mockResolvedValueOnce([table]);

    await expect(runInitWizard([definition])).rejects.toThrow(
      'cannot be scaffolded as a resource',
    );
    expect(schemaProvider.introspectTable).not.toHaveBeenCalled();
  });

  it('names every refused table at once', async () => {
    const schemaProvider = fakeSchemaProvider();
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox).mockResolvedValueOnce([
      'resource-unavailable',
      'a/b',
      'products',
    ]);

    const error = await runInitWizard([definition]).catch((err) => err);
    expect(error.message).toContain('"resource-unavailable" collides');
    expect(error.message).toContain('"a/b" contains "/"');
    expect(error.message).not.toContain('"products"');
  });

  it.each([
    ['a capitalized name', 'Mixed'],
    ['a space', 'my table'],
    ['a percent sign', '100%'],
    ['a dot inside a name', 'v1.2'],
    ['a name made of dots', '...'],
    ['a route-like word', 'create'],
  ])('accepts a table with %s as a route segment', async (_, table) => {
    const schemaProvider = fakeSchemaProvider();
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox)
      .mockResolvedValueOnce([table])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);

    const plan = await runInitWizard([definition]);
    expect(plan.tables[0].table).toBe(table);
  });

  it('shows an unavailable action as a disabled choice with its reason', async () => {
    const schemaProvider = fakeSchemaProvider({
      unavailableActions: [
        { action: 'create', reason: 'first reason' },
        { action: 'create', reason: 'second reason' },
        { action: 'delete', reason: 'no DELETE' },
      ],
    });
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);

    await runInitWizard([definition]);

    const choices = vi.mocked(checkbox).mock.calls[1][0].choices;
    expect(choices).toEqual([
      { name: 'List', value: 'list', checked: true },
      {
        name: 'Create',
        value: 'create',
        disabled: '(unavailable: first reason; second reason)',
      },
      { name: 'Show', value: 'show', checked: true },
      { name: 'Edit', value: 'edit', checked: true },
      { name: 'Delete', value: 'delete', disabled: '(unavailable: no DELETE)' },
    ]);
  });

  it('refuses an unavailable action even if it comes back selected', async () => {
    const schemaProvider = fakeSchemaProvider({
      unavailableActions: [{ action: 'create', reason: 'no INSERT' }],
    });
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce(['list', 'create']);

    await expect(runInitWizard([definition])).rejects.toThrow(
      '"products" cannot support create: no INSERT',
    );
  });

  it('refuses an empty action selection', async () => {
    const schemaProvider = fakeSchemaProvider();
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce([]);

    await expect(runInitWizard([definition])).rejects.toThrow(
      'Select at least one action for "products"',
    );
  });

  it('names the left-out columns in the actions prompt and only offers kept fields to hide', async () => {
    const schemaProvider = fakeSchemaProvider({
      excludedColumns: [
        { name: 'meta', reason: 'jsonb' },
        { name: 'tags', reason: 'text[]' },
      ],
    });
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);

    const plan = await runInitWizard([definition]);

    expect(vi.mocked(checkbox).mock.calls[1][0].message).toBe(
      'Which actions should "products" support? These columns are left out: meta (jsonb), tags (text[]).',
    );
    expect(
      vi
        .mocked(checkbox)
        .mock.calls[2][0].choices.map(
          (choice) => (choice as { value: string }).value,
        ),
    ).toEqual(['id', 'name']);
    expect(plan.tables[0].fields.map((field) => field.name)).toEqual([
      'id',
      'name',
    ]);
  });
});
