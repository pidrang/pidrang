import { FieldType } from '@pidrang/core';

const NUMBER_FORMATS = new Set([
  'int2',
  'int4',
  'smallint',
  'integer',
  'float4',
  'float8',
  'real',
  'double precision',
]);

const PRECISE_NUMBER_FORMATS = new Set([
  'int8',
  'bigint',
  'numeric',
  'decimal',
]);

const DATE_FORMATS = new Set(['date']);

const TIMESTAMP_FORMATS = new Set([
  'timestamp',
  'timestamptz',
  'timestamp without time zone',
  'timestamp with time zone',
]);

const TIME_FORMATS = new Set([
  'time',
  'timetz',
  'time without time zone',
  'time with time zone',
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
  if (format && TIMESTAMP_FORMATS.has(format)) {
    return 'timestamp';
  }
  if (format && TIME_FORMATS.has(format)) {
    return 'time';
  }
  if (format && PRECISE_NUMBER_FORMATS.has(format)) {
    return 'numeric';
  }
  if (
    type === 'integer' ||
    type === 'number' ||
    (format && NUMBER_FORMATS.has(format))
  ) {
    return 'number';
  }
  return 'text';
}
