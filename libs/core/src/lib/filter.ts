import { FilterOperator } from './filter-operator';

export interface Filter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}
