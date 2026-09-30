import { Filter } from './filter';

export interface ListParams {
  pagination?: {
    current?: number;
    pageSize?: number;
  };
  sorters?: {
    field: string;
    order: 'asc' | 'desc';
  }[];
  filters?: Filter[] | Record<string, unknown>;
}

export interface ListResult<T> {
  data: T[];
  total: number;
}
