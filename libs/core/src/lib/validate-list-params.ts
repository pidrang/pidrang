import { Filter } from './filter';
import { FilterOperator } from './filter-operator';
import { ListParams } from './list-params';
import { normalizeFilters } from './normalize-filters';

const OPERATORS = Object.keys({
  eq: true,
  ne: true,
  lt: true,
  lte: true,
  gt: true,
  gte: true,
  in: true,
  contains: true,
  null: true,
} satisfies Record<FilterOperator, true>) as FilterOperator[];

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

function sorterProblem(sorter: unknown): string | undefined {
  if (typeof sorter !== 'object' || sorter === null) {
    return 'each sorter must be an object';
  }
  if (
    !('field' in sorter) ||
    typeof sorter.field !== 'string' ||
    sorter.field === ''
  ) {
    return 'field must be a non-empty string';
  }
  if (
    !('order' in sorter) ||
    (sorter.order !== 'asc' && sorter.order !== 'desc')
  ) {
    return `order on "${sorter.field}" must be "asc" or "desc"`;
  }
  return undefined;
}

export function validateListParams(params: ListParams | undefined): void {
  const pagination: unknown = params?.pagination;
  if (
    pagination !== undefined &&
    pagination !== null &&
    (typeof pagination !== 'object' || Array.isArray(pagination))
  ) {
    throw new Error('Invalid pagination: expected an object');
  }
  for (const key of ['current', 'pageSize'] as const) {
    const value = params?.pagination?.[key];
    if (value !== undefined && !isPositiveInteger(value)) {
      throw new Error(
        `Invalid pagination.${key}: expected a positive integer, got ${String(value)}`,
      );
    }
  }
  const sorters: unknown = params?.sorters;
  if (sorters !== undefined && sorters !== null && !Array.isArray(sorters)) {
    throw new Error('Invalid sorters: expected an array of sorters');
  }
  for (const sorter of Array.isArray(sorters) ? sorters : []) {
    const problem = sorterProblem(sorter);
    if (problem) {
      throw new Error(`Invalid sorter: ${problem}`);
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
