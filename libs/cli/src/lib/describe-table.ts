import { Field } from '@pidrang/core';
import { ExcludedColumn } from './excluded-column';
import { IntrospectedColumn } from './introspected-column';
import { TableIntrospection } from './table-introspection';
import { UnavailableAction } from './unavailable-action';

export function describeTable(
  table: string,
  columns: IntrospectedColumn[],
  unavailableActions: UnavailableAction[] = [],
): TableIntrospection {
  const fields: Field[] = [];
  const excludedColumns: ExcludedColumn[] = [];
  const blocked = [...unavailableActions];
  for (const { type, ...column } of columns) {
    if (typeof type === 'string') {
      fields.push({ ...column, type });
      continue;
    }
    if (column.name === 'id') {
      throw new Error(
        `Table "${table}" has an "id" column pidrang cannot use (${type.unsupported}).`,
      );
    }
    excludedColumns.push({ name: column.name, reason: type.unsupported });
    if (!column.nullable && !column.hasDefault && !column.readOnly) {
      blocked.push({
        action: 'create',
        reason: `"${column.name}" is left out (${type.unsupported}) but needs a value on insert and has no default this strategy can see`,
      });
    }
  }
  if (!fields.some((field) => !field.readOnly)) {
    blocked.push({
      action: 'edit',
      reason: 'no column of this table can be edited in a generated form',
    });
  }
  return { fields, excludedColumns, unavailableActions: blocked };
}
