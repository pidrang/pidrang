import {
  CreateParams,
  DataProvider,
  DeleteParams,
  Filter,
  GetOneParams,
  ListParams,
  ListResult,
  PidrangError,
  UpdateParams,
  normalizeFilters,
  validateListParams,
} from '@pidrang/core';

type Row = Record<string, unknown>;

function compare(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function matches(row: Row, filter: Filter): boolean {
  const value = row[filter.field];
  switch (filter.operator) {
    case 'null':
      return (value === null || value === undefined) === filter.value;
    case 'in':
      return (filter.value as unknown[]).includes(value);
    case 'contains':
      return (
        typeof value === 'string' &&
        value.toLowerCase().includes(String(filter.value).toLowerCase())
      );
    default:
      if (value === null || value === undefined) {
        return false;
      }
  }
  const order = compare(value, filter.value);
  switch (filter.operator) {
    case 'eq':
      return value === filter.value;
    case 'ne':
      return value !== filter.value;
    case 'lt':
      return order < 0;
    case 'lte':
      return order <= 0;
    case 'gt':
      return order > 0;
    default:
      return order >= 0;
  }
}

function notFound(resource: string, id: string): PidrangError {
  return new PidrangError(`No ${resource} record with id ${id}`, {
    category: 'not-found',
  });
}

export function createInMemoryDataProvider(
  seed: Record<string, readonly Row[]>,
): DataProvider {
  const tables = new Map<string, Row[]>(
    Object.entries(seed).map(([name, rows]) => [
      name,
      rows.map((row) => ({ ...row })),
    ]),
  );
  const table = (resource: string): Row[] => {
    const rows = tables.get(resource);
    if (!rows) {
      throw new PidrangError(`Unknown resource ${resource}`, {
        category: 'not-found',
      });
    }
    return rows;
  };
  const find = (resource: string, id: string): Row => {
    const row = table(resource).find((candidate) => candidate['id'] === id);
    if (!row) {
      throw notFound(resource, id);
    }
    return row;
  };

  return {
    async getList<T>(
      resource: string,
      params?: ListParams,
    ): Promise<ListResult<T>> {
      validateListParams(params);
      const filters = normalizeFilters(params?.filters);
      const sorters = [
        ...(params?.sorters ?? []),
        ...(params?.sorters?.some((sorter) => sorter.field === 'id')
          ? []
          : [{ field: 'id', order: 'asc' as const }]),
      ];
      const rows = table(resource)
        .filter((row) => filters.every((filter) => matches(row, filter)))
        .sort((left, right) => {
          for (const sorter of sorters) {
            const order = compare(left[sorter.field], right[sorter.field]);
            if (order !== 0) {
              return sorter.order === 'asc' ? order : -order;
            }
          }
          return 0;
        });
      const { current = 1, pageSize = 10 } = params?.pagination ?? {};
      const from = (current - 1) * pageSize;
      return {
        data: rows
          .slice(from, from + pageSize)
          .map((row) => ({ ...row })) as T[],
        total: rows.length,
      };
    },

    async getOne<T>(resource: string, params: GetOneParams): Promise<T> {
      return { ...find(resource, params.id) } as T;
    },

    async create<T>(resource: string, params: CreateParams<T>): Promise<T> {
      const row = { id: globalThis.crypto.randomUUID(), ...params.data } as Row;
      table(resource).push(row);
      return { ...row } as T;
    },

    async update<T>(resource: string, params: UpdateParams<T>): Promise<T> {
      const row = find(resource, params.id);
      Object.assign(row, params.data);
      return { ...row } as T;
    },

    async delete<T>(resource: string, params: DeleteParams): Promise<T> {
      const row = find(resource, params.id);
      const rows = table(resource);
      rows.splice(rows.indexOf(row), 1);
      return { ...row } as T;
    },
  };
}
