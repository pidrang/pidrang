import {
  CreateParams,
  DataProvider,
  DeleteParams,
  Filter,
  GetOneParams,
  ListParams,
  ListResult,
  UpdateParams,
  normalizeFilters,
  validateListParams,
} from '@pidrang/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { escapeRegex } from './escape-regex';
import { postgrestInList } from './postgrest-in-list';
import { toError } from './to-error';

const RANGE_NOT_SATISFIABLE = 'PGRST103';

export class SupabaseDataProvider implements DataProvider {
  constructor(private readonly client: SupabaseClient) {}

  async getList<T>(
    resource: string,
    params?: ListParams,
  ): Promise<ListResult<T>> {
    validateListParams(params);
    const filters = normalizeFilters(params?.filters);

    let query = this.filteredQuery(resource, filters, false);

    const sorters = params?.sorters ?? [];
    for (const sorter of sorters) {
      query = query.order(sorter.field, { ascending: sorter.order === 'asc' });
    }
    if (!sorters.some((sorter) => sorter.field === 'id')) {
      query = query.order('id', { ascending: true });
    }

    const { current = 1, pageSize = 10 } = params?.pagination ?? {};
    const from = (current - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, count, error, status } = await query;
    if (error?.code === RANGE_NOT_SATISFIABLE) {
      const counted = await this.filteredQuery(resource, filters, true);
      if (counted.error) {
        throw toError(counted.error, counted.status);
      }
      return { data: [], total: counted.count ?? 0 };
    }
    if (error) {
      throw toError(error, status);
    }
    return { data: (data ?? []) as T[], total: count ?? 0 };
  }

  private filteredQuery(resource: string, filters: Filter[], head: boolean) {
    let query = this.client
      .from(resource)
      .select('*', { count: 'exact', head });
    for (const { field, operator, value } of filters) {
      switch (operator) {
        case 'eq':
          query = query.eq(field, value);
          break;
        case 'ne':
          query = query.neq(field, value);
          break;
        case 'lt':
          query = query.lt(field, value);
          break;
        case 'lte':
          query = query.lte(field, value);
          break;
        case 'gt':
          query = query.gt(field, value);
          break;
        case 'gte':
          query = query.gte(field, value);
          break;
        case 'in':
          query = query.filter(
            field,
            'in',
            postgrestInList(value as unknown[]),
          );
          break;
        case 'contains':
          query = query.filter(field, 'imatch', escapeRegex(String(value)));
          break;
        case 'null':
          query = value ? query.is(field, null) : query.not(field, 'is', null);
          break;
      }
    }
    return query;
  }

  async getOne<T>(resource: string, params: GetOneParams): Promise<T> {
    const { data, error, status } = await this.client
      .from(resource)
      .select('*')
      .eq('id', params.id)
      .single();
    if (error) {
      throw toError(error, status);
    }
    return data as T;
  }

  async create<T>(resource: string, params: CreateParams<T>): Promise<T> {
    const { data, error, status } = await this.client
      .from(resource)
      .insert(params.data as never)
      .select()
      .single();
    if (error) {
      throw toError(error, status);
    }
    return data as T;
  }

  async update<T>(resource: string, params: UpdateParams<T>): Promise<T> {
    const { data, error, status } = await this.client
      .from(resource)
      .update(params.data as never)
      .eq('id', params.id)
      .select()
      .single();
    if (error) {
      throw toError(error, status);
    }
    return data as T;
  }

  async delete<T>(resource: string, params: DeleteParams): Promise<T> {
    const { data, error, status } = await this.client
      .from(resource)
      .delete()
      .eq('id', params.id)
      .select()
      .single();
    if (error) {
      throw toError(error, status);
    }
    return data as T;
  }
}
