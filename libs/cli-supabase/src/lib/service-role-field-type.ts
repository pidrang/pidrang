import { FieldType } from '@pidrang/core';

const NUMBER_FORMATS = new Set([
  'int2',
  'int4',
  'int8',
  'smallint',
  'integer',
  'bigint',
  'float4',
  'float8',
  'real',
  'double precision',
  'numeric',
  'decimal',
]);

const DATE_FORMATS = new Set([
  'date',
  'time',
  'timetz',
  'timestamp',
  'timestamptz',
  'timestamp without time zone',
  'timestamp with time zone',
]);

export function openApiPropertyToFieldType(
  type: string,
  format: string | undefined,
): FieldType {
  if (type === 'boolean') {
    return 'boolean';
  }
  if (format && DATE_FORMATS.has(format)) {
    return 'date';
  }
  if (type === 'integer' || type === 'number' || (format && NUMBER_FORMATS.has(format))) {
    return 'number';
  }
  return 'text';
}
