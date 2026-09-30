import { Filter } from './filter';
import { FilterValue } from './filter-value';

export interface ListParams {
  pagination?: {
    current?: number;
    pageSize?: number;
  };
  sorters?: {
    field: string;
    order: 'asc' | 'desc';
  }[];
  filters?:
    | readonly Filter[]
    | {
        [column: string]: FilterValue | null | undefined;
        field?: never;
        operator?: never;
      };
}

export interface ListResult<T> {
  data: T[];
  total: number;
}
