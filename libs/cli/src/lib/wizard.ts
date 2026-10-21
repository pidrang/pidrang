import { checkbox, confirm, select } from '@inquirer/prompts';
import { SchemaProvider } from './schema-provider';
import {
  PlanEnvironment,
  SchemaProviderDefinition,
} from './schema-provider-definition';
import { CRUD_ACTIONS, CrudAction } from './crud-action';
import { InitResult, TablePlan } from './generation-plan';
import { InitPlan } from './init-plan';
import { TableIntrospection } from './table-introspection';

export interface InitOptions {
  takenRoutes?: readonly string[];
  reportLeftOutColumns?: (message: string) => void;
  warn?: (message: string) => void;
}

const ACTION_CHOICES: { name: string; value: CrudAction }[] = [
  { name: 'List', value: 'list' },
  { name: 'Create', value: 'create' },
  { name: 'Show', value: 'show' },
  { name: 'Edit', value: 'edit' },
  { name: 'Delete', value: 'delete' },
];

const ROUTES_OWNED_BY_GENERATED_PAGES = new Set(['resource-unavailable']);

const DOT_SEGMENTS = new Set(['.', '..']);

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function routeNameProblem(
  table: string,
  takenRoutes: readonly string[],
): string | null {
  if (ROUTES_OWNED_BY_GENERATED_PAGES.has(table)) {
    return 'collides with a route the generated pages reserve for their own use';
  }
  if (takenRoutes.includes(table)) {
    return 'collides with a route your app.routes.ts already declares';
  }
  if (table.trim() === '' || DOT_SEGMENTS.has(table)) {
    return 'cannot be used as a URL segment';
  }
  if (table.includes('/')) {
    return 'contains "/", which would split its URL into two segments';
  }
  if (hasControlCharacter(table)) {
    return 'contains a control character such as a newline';
  }
  return null;
}

function assertScaffoldableTables(
  tables: string[],
  options: InitOptions,
): void {
  if (tables.length === 0) {
    throw new Error('Select at least one table to scaffold.');
  }
  const routeProblems = tables.flatMap((table) => {
    const problem = routeNameProblem(table, options.takenRoutes ?? []);
    return problem ? [`${JSON.stringify(table)} ${problem}`] : [];
  });
  if (routeProblems.length > 0) {
    throw new Error(
      `These tables cannot be scaffolded as a resource: ${routeProblems.join('; ')}.`,
    );
  }
}

function assertSupportedActions(
  table: string,
  introspection: TableIntrospection,
  actions: CrudAction[],
): void {
  if (actions.length === 0) {
    throw new Error(`Select at least one action for "${table}".`);
  }
  for (const action of actions) {
    const reason = unavailableReason(introspection, action);
    if (reason) {
      throw new Error(`"${table}" cannot support ${action}: ${reason}.`);
    }
  }
}

function tablePlan(
  table: string,
  introspection: TableIntrospection,
  actions: CrudAction[],
  hiddenFields: string[],
): TablePlan {
  assertSupportedActions(table, introspection, actions);
  const fieldNames = introspection.fields.map((field) => field.name);
  const unknownFields = hiddenFields.filter(
    (field) => !fieldNames.includes(field),
  );
  if (unknownFields.length > 0) {
    throw new Error(
      `"${table}" has no field to hide named ${unknownFields.map((field) => JSON.stringify(field)).join(', ')}.`,
    );
  }
  return {
    table,
    fields: introspection.fields,
    actions: CRUD_ACTIONS.filter((action) => actions.includes(action)),
    hiddenFields: fieldNames.filter((field) => hiddenFields.includes(field)),
  };
}

export async function runInitWizard(
  providers: SchemaProviderDefinition[],
  options: InitOptions = {},
): Promise<InitResult> {
  const providerDefinition = await chooseProvider(providers);
  const connection = await providerDefinition.promptConnection();
  const schemaProvider = providerDefinition.createSchemaProvider(connection);

  const availableTables = await schemaProvider.listTables();
  const selectedTables = await checkbox({
    message: 'Which tables should pidrang scaffold?',
    choices: availableTables.map((table) => ({ name: table, value: table })),
  });
  assertScaffoldableTables(selectedTables, options);

  const tables: TablePlan[] = [];
  for (const table of selectedTables) {
    tables.push(await promptTable(schemaProvider, table));
  }

  return {
    providerId: providerDefinition.id,
    tables,
    setup: providerDefinition.appSetup(connection),
  };
}

export async function runScriptedInit(
  providers: SchemaProviderDefinition[],
  plan: InitPlan,
  env: PlanEnvironment,
  options: InitOptions = {},
): Promise<InitResult> {
  const providerDefinition = providers.find(
    (provider) => provider.id === plan.provider,
  );
  if (!providerDefinition) {
    throw new Error(
      `Unknown provider ${JSON.stringify(plan.provider)}. Registered providers: ${providers.map((provider) => provider.id).join(', ')}.`,
    );
  }
  const connection = await providerDefinition.connectionFromPlan(
    plan.connection,
    env,
    options.warn,
  );
  const schemaProvider = providerDefinition.createSchemaProvider(connection);

  const availableTables = await schemaProvider.listTables();
  const plannedTables = plan.tables.map((selection) => selection.table);
  const missingTables = plannedTables.filter(
    (table) => !availableTables.includes(table),
  );
  if (missingTables.length > 0) {
    throw new Error(
      `These tables are not among the tables this connection can scaffold: ${missingTables.map((table) => JSON.stringify(table)).join(', ')}.`,
    );
  }
  const selectedTables = availableTables.filter((table) =>
    plannedTables.includes(table),
  );
  assertScaffoldableTables(selectedTables, options);

  const tables: TablePlan[] = [];
  for (const table of selectedTables) {
    const selection = plan.tables.find((planned) => planned.table === table);
    const introspection = await schemaProvider.introspectTable(table);
    const leftOut = leftOutColumns(introspection);
    if (leftOut) {
      options.reportLeftOutColumns?.(`"${table}": ${leftOut}`);
    }
    tables.push(
      tablePlan(
        table,
        introspection,
        selection?.actions ?? [],
        selection?.hiddenFields ?? [],
      ),
    );
  }

  return {
    providerId: providerDefinition.id,
    tables,
    setup: providerDefinition.appSetup(connection),
  };
}

async function chooseProvider(
  providers: SchemaProviderDefinition[],
): Promise<SchemaProviderDefinition> {
  if (providers.length === 1) {
    return providers[0];
  }

  const providerId = await select({
    message: 'Which data source do you want to scaffold from?',
    choices: providers.map((provider) => ({
      name: provider.label,
      value: provider.id,
    })),
  });

  const definition = providers.find((provider) => provider.id === providerId);
  if (!definition) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return definition;
}

function unavailableReason(
  introspection: TableIntrospection,
  action: CrudAction,
): string | null {
  const reasons = introspection.unavailableActions
    .filter((unavailable) => unavailable.action === action)
    .map((unavailable) => unavailable.reason);
  return reasons.length > 0 ? reasons.join('; ') : null;
}

function leftOutColumns(introspection: TableIntrospection): string | null {
  if (introspection.excludedColumns.length === 0) {
    return null;
  }
  const excluded = introspection.excludedColumns
    .map((column) => `${column.name} (${column.reason})`)
    .join(', ');
  return `These columns are left out: ${excluded}.`;
}

function actionsMessage(
  table: string,
  introspection: TableIntrospection,
): string {
  const message = `Which actions should "${table}" support?`;
  const leftOut = leftOutColumns(introspection);
  return leftOut ? `${message} ${leftOut}` : message;
}

async function promptTable(
  schemaProvider: SchemaProvider,
  table: string,
): Promise<TablePlan> {
  const introspection = await schemaProvider.introspectTable(table);

  const actions = await checkbox<CrudAction>({
    message: actionsMessage(table, introspection),
    choices: ACTION_CHOICES.map((action) => {
      const reason = unavailableReason(introspection, action.value);
      return reason
        ? { ...action, disabled: `(unavailable: ${reason})` }
        : { ...action, checked: true };
    }),
  });
  assertSupportedActions(table, introspection, actions);

  const hiddenFields = await checkbox({
    message: `Any fields to hide from the list/edit views for "${table}"? (optional)`,
    choices: introspection.fields.map((field) => ({
      name: field.name,
      value: field.name,
    })),
  });

  return tablePlan(table, introspection, actions, hiddenFields);
}

export function confirmPackageInstall(): Promise<boolean> {
  return confirm({ message: 'Install the required packages?', default: true });
}
