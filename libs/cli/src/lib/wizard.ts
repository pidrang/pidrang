import { checkbox, select } from '@inquirer/prompts';
import { SchemaProvider } from './schema-provider';
import { SchemaProviderDefinition } from './schema-provider-definition';
import { CrudAction } from './crud-action';
import { GenerationPlan, TablePlan } from './generation-plan';
import { TableIntrospection } from './table-introspection';

const CRUD_ACTIONS: { name: string; value: CrudAction }[] = [
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

function routeNameProblem(table: string): string | null {
  if (ROUTES_OWNED_BY_GENERATED_PAGES.has(table)) {
    return 'collides with a route the generated pages reserve for their own use';
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

export async function runInitWizard(
  providers: SchemaProviderDefinition[],
): Promise<GenerationPlan> {
  const providerDefinition = await chooseProvider(providers);
  const connection = await providerDefinition.promptConnection();
  const schemaProvider = providerDefinition.createSchemaProvider(connection);

  const availableTables = await schemaProvider.listTables();
  const selectedTables = await checkbox({
    message: 'Which tables should pidrang scaffold?',
    choices: availableTables.map((table) => ({ name: table, value: table })),
  });
  if (selectedTables.length === 0) {
    throw new Error('Select at least one table to scaffold.');
  }
  const routeProblems = selectedTables.flatMap((table) => {
    const problem = routeNameProblem(table);
    return problem ? [`${JSON.stringify(table)} ${problem}`] : [];
  });
  if (routeProblems.length > 0) {
    throw new Error(
      `These tables cannot be scaffolded as a resource: ${routeProblems.join('; ')}.`,
    );
  }

  const tables: TablePlan[] = [];
  for (const table of selectedTables) {
    tables.push(await planTable(schemaProvider, table));
  }

  return { providerId: providerDefinition.id, tables };
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

function actionsMessage(
  table: string,
  introspection: TableIntrospection,
): string {
  const message = `Which actions should "${table}" support?`;
  if (introspection.excludedColumns.length === 0) {
    return message;
  }
  const excluded = introspection.excludedColumns
    .map((column) => `${column.name} (${column.reason})`)
    .join(', ');
  return `${message} These columns are left out: ${excluded}.`;
}

async function planTable(
  schemaProvider: SchemaProvider,
  table: string,
): Promise<TablePlan> {
  const introspection = await schemaProvider.introspectTable(table);

  const actions = await checkbox<CrudAction>({
    message: actionsMessage(table, introspection),
    choices: CRUD_ACTIONS.map((action) => {
      const reason = unavailableReason(introspection, action.value);
      return reason
        ? { ...action, disabled: `(unavailable: ${reason})` }
        : { ...action, checked: true };
    }),
  });
  if (actions.length === 0) {
    throw new Error(`Select at least one action for "${table}".`);
  }
  for (const action of actions) {
    const reason = unavailableReason(introspection, action);
    if (reason) {
      throw new Error(`"${table}" cannot support ${action}: ${reason}.`);
    }
  }

  const hiddenFields = await checkbox({
    message: `Any fields to hide from the list/edit views for "${table}"? (optional)`,
    choices: introspection.fields.map((field) => ({
      name: field.name,
      value: field.name,
    })),
  });

  return { table, fields: introspection.fields, actions, hiddenFields };
}
