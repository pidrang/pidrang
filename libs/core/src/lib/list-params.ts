export interface ListParams {
  pagination?: {
    current?: number;
    pageSize?: number;
  };
  sorters?: {
    field: string;
    order: 'asc' | 'desc';
  }[];
  filters?: Record<string, unknown>;
}

export interface ListResult<T> {
  data: T[];
  total: number;
}
