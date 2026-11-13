import { Filter } from './filter';
import { FilterValue } from './filter-value';
import { Sorter } from './sorter';

export interface ListParams {
  pagination?: {
    current?: number;
    pageSize?: number;
  };
  sorters?: Sorter[];
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
