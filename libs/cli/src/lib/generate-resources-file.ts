import { CrudAction } from './crud-action';
import { GenerationPlan, TablePlan } from './generation-plan';
import { quote } from './quote';

const CRUD_ACTIONS: CrudAction[] = ['list', 'create', 'show', 'edit', 'delete'];

export function generateResourcesFile(plan: GenerationPlan): string {
  const resources = plan.tables.map(generateResourceLiteral).join('\n');

  return [
    `import { Resource } from '@pidrang/core';`,
    ``,
    `export const resources: Resource[] = [`,
    resources,
    `];`,
    ``,
  ].join('\n');
}

function generateResourceLiteral(table: TablePlan): string {
  const fields = table.fields
    .map((field) => {
      const hidden = table.hiddenFields.includes(field.name);
      const flags = [
        hidden ? ', hidden: true' : '',
        field.readOnly ? ', readOnly: true' : '',
        field.nullable ? ', nullable: true' : '',
        field.hasDefault ? ', hasDefault: true' : '',
      ].join('');
      return `      { name: ${quote(field.name)}, type: ${quote(field.type)}${flags} },`;
    })
    .join('\n');

  const actions = CRUD_ACTIONS.map(
    (action) => `    ${action}: ${table.actions.includes(action)},`,
  ).join('\n');

  return [
    `  {`,
    `    name: ${quote(table.table)},`,
    `    fields: [`,
    fields,
    `    ],`,
    actions,
    `  },`,
  ].join('\n');
}
