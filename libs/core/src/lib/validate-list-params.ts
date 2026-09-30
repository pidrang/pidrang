import { Filter } from './filter';
import { FilterOperator } from './filter-operator';
import { ListParams } from './list-params';
import { normalizeFilters } from './normalize-filters';

const OPERATORS: readonly FilterOperator[] = [
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'contains',
  'null',
];

function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isScalar(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function filterProblem(filter: Filter): string | undefined {
  if (typeof filter.field !== 'string' || filter.field === '') {
    return 'field must be a non-empty string';
  }
  if (!OPERATORS.includes(filter.operator)) {
    return `unknown operator "${String(filter.operator)}", expected one of ${OPERATORS.join(', ')}`;
  }
  switch (filter.operator) {
    case 'null':
      return typeof filter.value === 'boolean'
        ? undefined
        : 'value must be a boolean for the null operator';
    case 'contains':
      return typeof filter.value === 'string'
        ? undefined
        : 'value must be a string for the contains operator';
    case 'in':
      if (!Array.isArray(filter.value)) {
        return 'value must be an array for the in operator';
      }
      return filter.value.every(isScalar)
        ? undefined
        : 'value must only contain strings, finite numbers or booleans';
    default:
      if (filter.value === null) {
        return 'value is null: use the null operator to match missing values';
      }
      return isScalar(filter.value)
        ? undefined
        : 'value must be a string, a finite number or a boolean';
  }
}

export function validateListParams(params: ListParams | undefined): void {
  const pagination = params?.pagination;
  for (const key of ['current', 'pageSize'] as const) {
    const value = pagination?.[key];
    if (value !== undefined && !isPositiveInteger(value)) {
      throw new Error(
        `Invalid pagination.${key}: expected a positive integer, got ${String(value)}`,
      );
    }
  }
  for (const filter of normalizeFilters(params?.filters)) {
    if (typeof filter !== 'object' || filter === null) {
      throw new Error('Invalid filter: each filter must be an object');
    }
    const problem = filterProblem(filter);
    if (problem) {
      throw new Error(
        `Invalid filter on "${String(filter.field)}": ${problem}`,
      );
    }
  }
}
