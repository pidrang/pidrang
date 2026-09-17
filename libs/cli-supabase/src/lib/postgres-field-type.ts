import { FieldType } from '@pidrang/core';

const NUMBER_TYPES = new Set([
  'smallint',
  'integer',
  'bigint',
  'decimal',
  'numeric',
  'real',
  'double precision',
]);

const DATE_TYPES = new Set([
  'date',
  'timestamp without time zone',
  'timestamp with time zone',
  'time without time zone',
  'time with time zone',
]);

export function postgresTypeToFieldType(dataType: string): FieldType {
  if (dataType === 'boolean') {
    return 'boolean';
  }
  if (NUMBER_TYPES.has(dataType)) {
    return 'number';
  }
  if (DATE_TYPES.has(dataType)) {
    return 'date';
  }
  return 'text';
}
