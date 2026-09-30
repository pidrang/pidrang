import { Filter } from './filter';
import { FilterOperator } from './filter-operator';

export function rejectUnsupportedFilters(
  filters: Filter[],
  supported: readonly FilterOperator[],
): void {
  const unsupported = filters.find(
    (filter) => !supported.includes(filter.operator),
  );
  if (unsupported) {
    throw new Error(
      `Unsupported filter operator "${unsupported.operator}" on field "${unsupported.field}"`,
    );
  }
}
