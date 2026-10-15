import { FieldType } from '@pidrang/core';
import { UnsupportedColumnType } from '@pidrang/cli';

const TEXT_TYPES = new Set(['String', 'UUID']);
const NUMBER_TYPES = new Set(['Int', 'Float']);
const PRECISE_NUMBER_TYPES = new Set(['BigInt', 'BigFloat']);

export function graphqlScalarToFieldType(
  kind: string,
  typeName: string,
): FieldType | UnsupportedColumnType {
  if (kind === 'LIST') {
    return { unsupported: `a list of ${typeName}` };
  }
  if (kind === 'ENUM') {
    return { unsupported: `enum ${typeName}` };
  }
  if (typeName === 'Boolean') {
    return 'boolean';
  }
  if (typeName === 'Date') {
    return 'date';
  }
  if (typeName === 'Datetime') {
    return 'timestamp';
  }
  if (typeName === 'Time') {
    return 'time';
  }
  if (NUMBER_TYPES.has(typeName)) {
    return 'number';
  }
  if (PRECISE_NUMBER_TYPES.has(typeName)) {
    return 'numeric';
  }
  if (TEXT_TYPES.has(typeName)) {
    return 'text';
  }
  return { unsupported: typeName };
}
