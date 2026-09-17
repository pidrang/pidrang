import { checkbox, select } from '@inquirer/prompts';
import { SchemaProvider } from './schema-provider';
import { SchemaProviderDefinition } from './schema-provider-definition';
import { CrudAction } from './crud-action';
import { GenerationPlan, TablePlan } from './generation-plan';

const CRUD_ACTIONS: { name: string; value: CrudAction }[] = [
  { name: 'List', value: 'list' },
  { name: 'Create', value: 'create' },
  { name: 'Show', value: 'show' },
  { name: 'Edit', value: 'edit' },
  { name: 'Delete', value: 'delete' },
];

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

async function planTable(
  schemaProvider: SchemaProvider,
  table: string,
): Promise<TablePlan> {
  const fields = await schemaProvider.introspectTable(table);

  const actions = await checkbox<CrudAction>({
    message: `Which actions should "${table}" support?`,
    choices: CRUD_ACTIONS.map((action) => ({ ...action, checked: true })),
  });

  const hiddenFields = await checkbox({
    message: `Any fields to hide from the list/edit views for "${table}"? (optional)`,
    choices: fields.map((field) => ({ name: field.name, value: field.name })),
  });

  return { table, fields, actions, hiddenFields };
}
