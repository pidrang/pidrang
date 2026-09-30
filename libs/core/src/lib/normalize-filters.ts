import { Filter } from './filter';
import { ListParams } from './list-params';

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function kindOf(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return typeof value;
  }
  return Object.getPrototypeOf(value)?.constructor?.name ?? 'object';
}

export function normalizeFilters(filters: ListParams['filters']): Filter[] {
  if (filters === undefined || filters === null) {
    return [];
  }
  if (Array.isArray(filters)) {
    return [...filters];
  }
  if (typeof filters !== 'object' || !isPlainObject(filters)) {
    throw new Error(
      `Invalid filters: expected an array of filters or a plain object of field values, got ${kindOf(filters)}`,
    );
  }
  if ('field' in filters && 'operator' in filters) {
    throw new Error(
      'Invalid filters: got a single filter object, wrap the filter in an array',
    );
  }
  return Object.entries(filters).flatMap(([field, value]): Filter[] => {
    if (value === undefined) {
      return [];
    }
    return value === null
      ? [{ field, operator: 'null', value: true }]
      : [{ field, operator: 'eq', value }];
  });
}
