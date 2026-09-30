import { FilterValue } from './filter-value';

export type Filter =
  | {
      field: string;
      operator: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';
      value: FilterValue;
    }
  | { field: string; operator: 'in'; value: readonly FilterValue[] }
  | { field: string; operator: 'contains'; value: string }
  | { field: string; operator: 'null'; value: boolean };
