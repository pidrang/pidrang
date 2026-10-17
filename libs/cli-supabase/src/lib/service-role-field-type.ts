import { FieldType } from '@pidrang/core';
import { UnsupportedColumnType } from '@pidrang/cli';

const TEXT_FORMATS = new Set([
  'text',
  'character varying',
  'varchar',
  'character',
  'char',
  'bpchar',
  'uuid',
]);

const BOOLEAN_FORMATS = new Set(['boolean', 'bool']);

const NUMBER_FORMATS = new Set([
  'int2',
  'int4',
  'int32',
  'smallint',
  'integer',
  'float4',
  'float8',
  'real',
  'double precision',
]);

const PRECISE_NUMBER_FORMATS = new Set([
  'int8',
  'int64',
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

export interface OpenApiProperty {
  type?: string;
  format?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
}

export function openApiPropertyToFieldType(
  property: OpenApiProperty,
): FieldType | UnsupportedColumnType {
  const format = property.format ?? '';
  const typeName = property.format ?? property.type ?? 'an unknown type';
  if (property.enum) {
    return { unsupported: `enum ${typeName}` };
  }
  if (property.type === 'array') {
    return { unsupported: typeName };
  }
  if (property.type === 'boolean' || BOOLEAN_FORMATS.has(format)) {
    return 'boolean';
  }
  if (DATE_FORMATS.has(format)) {
    return 'date';
  }
  if (TIMESTAMP_FORMATS.has(format)) {
    return 'timestamp';
  }
  if (TIME_FORMATS.has(format)) {
    return 'time';
  }
  if (PRECISE_NUMBER_FORMATS.has(format)) {
    return 'numeric';
  }
  if (NUMBER_FORMATS.has(format)) {
    return 'number';
  }
  if (TEXT_FORMATS.has(format)) {
    return 'text';
  }
  return { unsupported: typeName };
}
