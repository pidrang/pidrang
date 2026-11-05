import { Field } from '@pidrang/core';
import { ExcludedColumn } from './excluded-column';
import { IntrospectedColumn } from './introspected-column';
import { TableIntrospection } from './table-introspection';
import { UnavailableAction } from './unavailable-action';

const AUDIT_COLUMNS = ['created_at', 'updated_at', 'createdAt', 'updatedAt'];

function isAuditColumn(field: Field): boolean {
  return field.type === 'timestamp' && AUDIT_COLUMNS.includes(field.name);
}

export interface DescribeTableOptions {
  defaultsVisible: boolean;
}

function sqlIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function auditColumnWithoutDefault(
  table: string,
  column: string,
): UnavailableAction {
  return {
    action: 'create',
    reason: `"${column}" has no database default and the create form never asks for it: run alter table public.${sqlIdentifier(table)} alter column ${sqlIdentifier(column)} set default now(); or, if a trigger already fills it, set create: true for "${table}" in src/app/resources.ts`,
  };
}

export function describeTable(
  table: string,
  columns: IntrospectedColumn[],
  unavailableActions: UnavailableAction[] = [],
  { defaultsVisible }: DescribeTableOptions = { defaultsVisible: true },
): TableIntrospection {
  const fields: Field[] = [];
  const excludedColumns: ExcludedColumn[] = [];
  const blocked = [...unavailableActions];
  for (const { type, ...column } of columns) {
    if (typeof type === 'string') {
      const field: Field = { ...column, type };
      if (!isAuditColumn(field)) {
        fields.push(field);
        continue;
      }
      fields.push({ ...field, readOnly: true });
      if (
        defaultsVisible &&
        !field.nullable &&
        !field.hasDefault &&
        !field.readOnly
      ) {
        blocked.push(auditColumnWithoutDefault(table, field.name));
      }
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
