import { FieldType } from '@pidrang/core';

const NUMBER_TYPES = new Set(['Int', 'BigInt', 'Float', 'BigFloat']);
const DATE_TYPES = new Set(['Date', 'Datetime', 'Time']);

export function graphqlScalarToFieldType(typeName: string): FieldType {
  if (typeName === 'Boolean') {
    return 'boolean';
  }
  if (NUMBER_TYPES.has(typeName)) {
    return 'number';
  }
  if (DATE_TYPES.has(typeName)) {
    return 'date';
  }
  return 'text';
}
