import { FieldType } from '@pidrang/core';

const NUMBER_TYPES = new Set(['Int', 'Float']);
const PRECISE_NUMBER_TYPES = new Set(['BigInt', 'BigFloat']);

export function graphqlScalarToFieldType(typeName: string): FieldType {
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
  return 'text';
}
