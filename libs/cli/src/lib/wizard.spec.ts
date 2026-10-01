import { checkbox, select } from '@inquirer/prompts';
import { runInitWizard } from './wizard';
import { SchemaProvider } from './schema-provider';
import { SchemaProviderDefinition } from './schema-provider-definition';

vi.mock('@inquirer/prompts', () => ({
  checkbox: vi.fn(),
  select: vi.fn(),
}));

function fakeSchemaProvider(): SchemaProvider {
  return {
    listTables: vi.fn().mockResolvedValue(['products', 'orders']),
    introspectTable: vi.fn().mockResolvedValue([
      { name: 'id', type: 'number' },
      { name: 'name', type: 'text' },
    ]),
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
      'resource-unavailable',
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
});
