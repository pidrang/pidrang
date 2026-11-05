import { Field } from '@pidrang/core';
import { CRUD_ACTIONS } from './crud-action';
import { GenerationPlan, TablePlan } from './generation-plan';
import { quote } from './quote';
import { readableLabel } from './readable-label';

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
      return `      { name: ${quote(field.name)}, label: ${quote(readableLabel(field.name))}, type: ${quote(field.type)}${flags} },`;
    })
    .join('\n');

  const actions = CRUD_ACTIONS.map(
    (action) => `    ${action}: ${table.actions.includes(action)},`,
  ).join('\n');

  return [
    `  {`,
    `    name: ${quote(table.table)},`,
    `    label: ${quote(readableLabel(table.table))},`,
    `    fields: [`,
    fields,
    `    ],`,
    ...defaultSortersLines(table.fields),
    actions,
    `  },`,
  ].join('\n');
}

const CREATED_AT_COLUMNS = ['created_at', 'createdAt'];

function sortableCreatedAt(fields: Field[]): Field | undefined {
  for (const name of CREATED_AT_COLUMNS) {
    const field = fields.find((candidate) => candidate.name === name);
    if (field?.type === 'timestamp' || field?.type === 'date') {
      return field;
    }
  }
  return undefined;
}

function defaultSortersLines(fields: Field[]): string[] {
  const createdAt = sortableCreatedAt(fields);
  if (createdAt === undefined) {
    return [];
  }
  return [
    `    defaultSorters: [`,
    `      { field: ${quote(createdAt.name)}, order: 'desc' },`,
    `      { field: 'id', order: 'asc' },`,
    `    ],`,
  ];
}
