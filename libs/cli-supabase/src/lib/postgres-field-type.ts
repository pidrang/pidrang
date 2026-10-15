import { FieldType } from '@pidrang/core';
import { UnsupportedColumnType } from '@pidrang/cli';

const TEXT_TYPES = new Set(['text', 'character varying', 'character', 'uuid']);

const NUMBER_TYPES = new Set([
  'smallint',
  'integer',
  'real',
  'double precision',
]);

const PRECISE_NUMBER_TYPES = new Set(['bigint', 'decimal', 'numeric']);

const TIMESTAMP_TYPES = new Set([
  'timestamp without time zone',
  'timestamp with time zone',
]);

const TIME_TYPES = new Set(['time without time zone', 'time with time zone']);

function unsupportedTypeName(dataType: string, udtName: string): string {
  if (dataType === 'ARRAY') {
    return `${udtName.replace(/^_/, '')}[]`;
  }
  if (dataType === 'USER-DEFINED') {
    return udtName;
  }
  return dataType;
}

export function postgresTypeToFieldType(
  dataType: string,
  udtName: string,
): FieldType | UnsupportedColumnType {
  if (dataType === 'boolean') {
    return 'boolean';
  }
  if (dataType === 'date') {
    return 'date';
  }
  if (TIMESTAMP_TYPES.has(dataType)) {
    return 'timestamp';
  }
  if (TIME_TYPES.has(dataType)) {
    return 'time';
  }
  if (NUMBER_TYPES.has(dataType)) {
    return 'number';
  }
  if (PRECISE_NUMBER_TYPES.has(dataType)) {
    return 'numeric';
  }
  if (TEXT_TYPES.has(dataType)) {
    return 'text';
  }
  return { unsupported: unsupportedTypeName(dataType, udtName) };
}
