import { Filter } from './filter';
import { ListParams } from './list-params';

export function normalizeFilters(filters: ListParams['filters']): Filter[] {
  if (filters === undefined || filters === null) {
    return [];
  }
  if (Array.isArray(filters)) {
    return filters;
  }
  return Object.entries(filters)
    .filter(([, value]) => value !== undefined)
    .map(
      ([field, value]): Filter =>
        value === null
          ? { field, operator: 'null', value: true }
          : { field, operator: 'eq', value },
    );
}
