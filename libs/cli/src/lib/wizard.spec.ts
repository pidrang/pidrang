import { checkbox, confirm, select } from '@inquirer/prompts';
import { AppSetup } from './app-setup';
import {
  confirmPackageInstall,
  runInitWizard,
  runScriptedInit,
} from './wizard';
import { InitPlan } from './init-plan';
import { SchemaProvider } from './schema-provider';
import { SchemaProviderDefinition } from './schema-provider-definition';
import { TableIntrospection } from './table-introspection';

vi.mock('@inquirer/prompts', () => ({
  checkbox: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
}));

const SETUP: AppSetup = {
  imports: [{ name: 'provideFake', from: 'fake' }],
  constants: [],
  pidrangConfig: [{ name: 'dataProvider', value: 'provideFake()' }],
  environment: [],
  notes: [],
  packages: [],
};

function fakeSchemaProvider(
  introspection: Partial<TableIntrospection> = {},
  readsNeedSignIn: SchemaProvider['readsNeedSignIn'] | null = vi
    .fn()
    .mockResolvedValue(false),
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
    ...(readsNeedSignIn === null ? {} : { readsNeedSignIn }),
  };
}

function fakeDefinition(
  id: string,
  schemaProvider: SchemaProvider,
): SchemaProviderDefinition {
  return {
    id,
    label: id,
    planHelp: `${id} help`,
    promptConnection: vi.fn().mockResolvedValue({}),
    connectionFromPlan: vi.fn().mockResolvedValue({ from: 'plan' }),
    createSchemaProvider: vi.fn().mockReturnValue(schemaProvider),
    appSetup: vi.fn().mockReturnValue(SETUP),
  };
}

describe('runInitWizard', () => {
  beforeEach(() => {
    vi.mocked(checkbox).mockReset();
    vi.mocked(select).mockReset();
    vi.mocked(confirm).mockReset();
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
    expect(definition.appSetup).toHaveBeenCalledWith({});
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
          readsNeedSignIn: false,
        },
      ],
      setup: SETUP,
      layout: 'none',
      signIn: true,
    });
  });

  it('asks for a navigation layout on a new app', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider());

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);
    vi.mocked(confirm).mockResolvedValueOnce(true);

    const plan = await runInitWizard([definition], { isNewApp: true });

    expect(confirm).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ message: expect.stringContaining('layout') }),
    );
    expect(plan.layout).toBe('sidebar');
  });

  it('leaves a new app without a layout when declined', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider());

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);
    vi.mocked(confirm).mockResolvedValueOnce(false);

    const plan = await runInitWizard([definition], { isNewApp: true });

    expect(plan.layout).toBe('none');
  });

  it('asks for a sign-in page on a new app and generates it by default', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider());

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);
    vi.mocked(confirm).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const plan = await runInitWizard([definition], { isNewApp: true });

    expect(confirm).toHaveBeenLastCalledWith({
      message: expect.stringContaining('/sign-in'),
      default: true,
    });
    expect(plan.signIn).toBe(true);
  });

  it('counts a declined sign-in question as false', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider());

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);
    vi.mocked(confirm)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);

    const plan = await runInitWizard([definition], { isNewApp: true });

    expect(plan.layout).toBe('none');
    expect(plan.signIn).toBe(false);
  });

  it('generates the sign-in page without asking in an app that already exists', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider());

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);

    const plan = await runInitWizard([definition]);

    expect(confirm).not.toHaveBeenCalled();
    expect(plan.signIn).toBe(true);
  });

  it('does not ask for a layout in an app that already exists', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider());

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);

    const plan = await runInitWizard([definition]);

    expect(confirm).not.toHaveBeenCalled();
    expect(plan.layout).toBe('none');
  });

  it('applies the answer of the provider to every table without asking', async () => {
    const readsNeedSignIn = vi.fn().mockResolvedValue(true);
    const definition = fakeDefinition(
      'supabase',
      fakeSchemaProvider({}, readsNeedSignIn),
    );

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products', 'orders'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);

    const plan = await runInitWizard([definition]);

    expect(readsNeedSignIn).toHaveBeenCalledWith('products');
    expect(readsNeedSignIn).toHaveBeenCalledWith('orders');
    expect(confirm).not.toHaveBeenCalled();
    expect(plan.tables.map((table) => table.readsNeedSignIn)).toEqual([
      true,
      true,
    ]);
  });

  it('asks whether reads need a signed-in user on a new app when the provider cannot tell', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider({}, null));

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);
    vi.mocked(confirm).mockResolvedValue(true);

    const plan = await runInitWizard([definition], { isNewApp: true });

    expect(vi.mocked(confirm).mock.calls[0][0]).toEqual({
      message: expect.stringContaining('signed-in user'),
      default: false,
    });
    expect(plan.tables[0].readsNeedSignIn).toBe(true);
  });

  it('does not ask about reads in an app that already exists', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider({}, null));

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);

    const plan = await runInitWizard([definition]);

    expect(confirm).not.toHaveBeenCalled();
    expect(plan.tables[0].readsNeedSignIn).toBe(false);
  });

  it('asks the question for the tables the provider leaves open only', async () => {
    const readsNeedSignIn = vi
      .fn()
      .mockImplementation(async (table: string) =>
        table === 'orders' ? true : null,
      );
    const definition = fakeDefinition(
      'supabase',
      fakeSchemaProvider({}, readsNeedSignIn),
    );

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products', 'orders'])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['list'])
      .mockResolvedValueOnce([]);
    vi.mocked(confirm).mockResolvedValue(false);

    const plan = await runInitWizard([definition], { isNewApp: true });

    const asked = vi
      .mocked(confirm)
      .mock.calls.filter(([question]) =>
        question.message.includes('signed-in user'),
      );
    expect(asked).toHaveLength(1);
    expect(
      plan.tables.map((table) => [table.table, table.readsNeedSignIn]),
    ).toEqual([
      ['products', false],
      ['orders', true],
    ]);
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

  it('refuses a table named after a route the app already declares', async () => {
    const schemaProvider = fakeSchemaProvider();
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox).mockResolvedValueOnce(['products', 'orders']);

    const error = await runInitWizard([definition], {
      takenRoutes: ['login', 'orders'],
    }).catch((err) => err);
    expect(error.message).toContain(
      '"orders" collides with a route your app.routes.ts already declares',
    );
    expect(error.message).not.toContain('"products"');
    expect(schemaProvider.introspectTable).not.toHaveBeenCalled();
  });
});

describe('runScriptedInit', () => {
  function scripted(tables: InitPlan['tables']): InitPlan {
    return {
      provider: 'supabase',
      connection: { url: 'u' },
      tables,
      layout: 'none',
      signIn: false,
      readsNeedSignIn: false,
    };
  }

  beforeEach(() => {
    vi.mocked(checkbox).mockReset();
    vi.mocked(select).mockReset();
    vi.mocked(confirm).mockReset();
  });

  it('hands the warn option to the provider reading the plan', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider());
    const warn = vi.fn();

    await runScriptedInit(
      [definition],
      scripted([{ table: 'products', actions: ['list'], hiddenFields: [] }]),
      {},
      { warn },
    );

    expect(definition.connectionFromPlan).toHaveBeenCalledWith(
      { url: 'u' },
      {},
      warn,
    );
  });

  it('generates the sign-in page only when the plan asks for it', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider());
    const tables = [{ table: 'products', actions: ['list'], hiddenFields: [] }];

    const wanted = await runScriptedInit(
      [definition],
      { ...scripted(tables), signIn: true },
      {},
    );
    const notWanted = await runScriptedInit([definition], scripted(tables), {});

    expect(wanted.signIn).toBe(true);
    expect(notWanted.signIn).toBe(false);
  });

  it('builds the plan without any prompt, from the connection the provider reads', async () => {
    const schemaProvider = fakeSchemaProvider();
    const definition = fakeDefinition('supabase', schemaProvider);
    const env = { KEY: 'value' };

    const plan = await runScriptedInit(
      [definition],
      {
        ...scripted([
          { table: 'products', actions: ['list', 'create'], hiddenFields: [] },
        ]),
        signIn: true,
      },
      env,
    );

    expect(definition.connectionFromPlan).toHaveBeenCalledWith(
      { url: 'u' },
      env,
      undefined,
    );
    expect(definition.createSchemaProvider).toHaveBeenCalledWith({
      from: 'plan',
    });
    expect(definition.appSetup).toHaveBeenCalledWith({ from: 'plan' });
    expect(definition.promptConnection).not.toHaveBeenCalled();
    expect(checkbox).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
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
          readsNeedSignIn: false,
        },
      ],
      setup: SETUP,
      layout: 'none',
      signIn: true,
    });
  });

  it('gives the same plan as the wizard for the same choices in any order', async () => {
    const schemaProvider = fakeSchemaProvider();
    const definition = fakeDefinition('supabase', schemaProvider);

    vi.mocked(checkbox)
      .mockResolvedValueOnce(['products', 'orders'])
      .mockResolvedValueOnce(['list', 'show', 'delete'])
      .mockResolvedValueOnce(['id', 'name'])
      .mockResolvedValueOnce(['create'])
      .mockResolvedValueOnce([]);
    const interactive = await runInitWizard([definition]);

    const fromPlan = await runScriptedInit(
      [definition],
      {
        ...scripted([
          { table: 'orders', actions: ['create'], hiddenFields: [] },
          {
            table: 'products',
            actions: ['delete', 'list', 'show'],
            hiddenFields: ['name', 'id'],
          },
        ]),
        signIn: true,
      },
      {},
    );

    expect(fromPlan).toEqual(interactive);
  });

  it('takes the readsNeedSignIn of the plan when the provider cannot tell', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider({}, null));

    const plan = await runScriptedInit(
      [definition],
      {
        ...scripted([
          { table: 'products', actions: ['list'], hiddenFields: [] },
        ]),
        readsNeedSignIn: true,
      },
      {},
    );

    expect(plan.tables[0].readsNeedSignIn).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('prefers the answer of the provider to the plan key', async () => {
    const readsNeedSignIn = vi.fn().mockResolvedValue(false);
    const definition = fakeDefinition(
      'supabase',
      fakeSchemaProvider({}, readsNeedSignIn),
    );

    const plan = await runScriptedInit(
      [definition],
      {
        ...scripted([
          { table: 'products', actions: ['list'], hiddenFields: [] },
        ]),
        readsNeedSignIn: true,
      },
      {},
    );

    expect(plan.tables[0].readsNeedSignIn).toBe(false);
  });

  it('names the provider ids it knows when the plan asks for another one', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider());

    await expect(
      runScriptedInit([definition], { ...scripted([]), provider: 'rest' }, {}),
    ).rejects.toThrow(
      'Unknown provider "rest". Registered providers: supabase.',
    );
    expect(definition.connectionFromPlan).not.toHaveBeenCalled();
  });

  it('refuses tables the connection cannot scaffold, before introspecting anything', async () => {
    const schemaProvider = fakeSchemaProvider();
    const definition = fakeDefinition('supabase', schemaProvider);

    await expect(
      runScriptedInit(
        [definition],
        scripted([
          { table: 'products', actions: ['list'], hiddenFields: [] },
          { table: 'missing', actions: ['list'], hiddenFields: [] },
        ]),
        {},
      ),
    ).rejects.toThrow(
      'These tables are not among the tables this connection can scaffold: "missing".',
    );
    expect(schemaProvider.introspectTable).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a reserved route',
      'resource-unavailable',
      [],
      'reserve for their own use',
    ],
    ['a route of the app', 'login', ['login'], 'already declares'],
    ['a slash', 'a/b', [], 'contains "/"'],
  ])(
    'refuses a table named after %s like the wizard does',
    async (_, table, takenRoutes, message) => {
      const schemaProvider = fakeSchemaProvider();
      vi.mocked(schemaProvider.listTables).mockResolvedValue([table]);
      const definition = fakeDefinition('supabase', schemaProvider);

      await expect(
        runScriptedInit(
          [definition],
          scripted([{ table, actions: ['list'], hiddenFields: [] }]),
          {},
          { takenRoutes },
        ),
      ).rejects.toThrow(message);
      expect(schemaProvider.introspectTable).not.toHaveBeenCalled();
    },
  );

  it('refuses an action the table cannot support', async () => {
    const schemaProvider = fakeSchemaProvider({
      unavailableActions: [{ action: 'delete', reason: 'no DELETE' }],
    });
    const definition = fakeDefinition('supabase', schemaProvider);

    await expect(
      runScriptedInit(
        [definition],
        scripted([
          { table: 'products', actions: ['list', 'delete'], hiddenFields: [] },
        ]),
        {},
      ),
    ).rejects.toThrow('"products" cannot support delete: no DELETE.');
  });

  it('refuses an empty action list', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider());

    await expect(
      runScriptedInit(
        [definition],
        scripted([{ table: 'products', actions: [], hiddenFields: [] }]),
        {},
      ),
    ).rejects.toThrow('Select at least one action for "products".');
  });

  it('refuses to hide a field the table does not have, or one that is left out', async () => {
    const schemaProvider = fakeSchemaProvider({
      excludedColumns: [{ name: 'meta', reason: 'jsonb' }],
    });
    const definition = fakeDefinition('supabase', schemaProvider);

    await expect(
      runScriptedInit(
        [definition],
        scripted([
          {
            table: 'products',
            actions: ['list'],
            hiddenFields: ['name', 'meta', 'nope'],
          },
        ]),
        {},
      ),
    ).rejects.toThrow('"products" has no field to hide named "meta", "nope".');
  });

  it('reports the left-out columns of each table that has some, in table order', async () => {
    const schemaProvider = fakeSchemaProvider();
    vi.mocked(schemaProvider.introspectTable).mockImplementation(
      async (table) => ({
        fields: [{ name: 'id', type: 'number' }],
        excludedColumns:
          table === 'orders'
            ? [
                { name: 'meta', reason: 'jsonb' },
                { name: 'tags', reason: 'text[]' },
              ]
            : [],
        unavailableActions: [],
      }),
    );
    const definition = fakeDefinition('supabase', schemaProvider);
    const reported: string[] = [];

    await runScriptedInit(
      [definition],
      scripted([
        { table: 'orders', actions: ['list'], hiddenFields: [] },
        { table: 'products', actions: ['list'], hiddenFields: [] },
      ]),
      {},
      { reportLeftOutColumns: (message) => reported.push(message) },
    );

    expect(reported).toEqual([
      '"orders": These columns are left out: meta (jsonb), tags (text[]).',
    ]);
  });

  it('reports nothing when no column is left out', async () => {
    const definition = fakeDefinition('supabase', fakeSchemaProvider());
    const reported: string[] = [];

    await runScriptedInit(
      [definition],
      scripted([{ table: 'products', actions: ['list'], hiddenFields: [] }]),
      {},
      { reportLeftOutColumns: (message) => reported.push(message) },
    );

    expect(reported).toEqual([]);
  });
});

describe('confirmPackageInstall', () => {
  it('asks to install the packages with yes as the default', async () => {
    vi.mocked(confirm).mockResolvedValueOnce(false);

    expect(await confirmPackageInstall()).toBe(false);
    expect(confirm).toHaveBeenCalledWith({
      message: 'Install the required packages?',
      default: true,
    });
  });
});
