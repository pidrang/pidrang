import {
  CreateParams,
  DataProvider,
  DeleteParams,
  GetOneParams,
  ListParams,
  ListResult,
  UpdateParams,
  validateListParams,
} from '@pidrang/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { toError } from './to-error';

export class SupabaseDataProvider implements DataProvider {
  constructor(private readonly client: SupabaseClient) {}

  async getList<T>(
    resource: string,
    params?: ListParams,
  ): Promise<ListResult<T>> {
    validateListParams(params);

    let query = this.client.from(resource).select('*', { count: 'exact' });

    for (const [column, value] of Object.entries(params?.filters ?? {})) {
      query = query.eq(column, value);
    }

    for (const sorter of params?.sorters ?? []) {
      query = query.order(sorter.field, { ascending: sorter.order === 'asc' });
    }

    const { current = 1, pageSize = 10 } = params?.pagination ?? {};
    const from = (current - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, count, error } = await query;
    if (error) {
      throw toError(error);
    }
    return { data: (data ?? []) as T[], total: count ?? 0 };
  }

  async getOne<T>(resource: string, params: GetOneParams): Promise<T> {
    const { data, error } = await this.client
      .from(resource)
      .select('*')
      .eq('id', params.id)
      .single();
    if (error) {
      throw toError(error);
    }
    return data as T;
  }

  async create<T>(resource: string, params: CreateParams<T>): Promise<T> {
    // Cast needed: without a typed Database schema, postgrest-js can't unify
    // its insert row type with our unconstrained generic T.
    const { data, error } = await this.client
      .from(resource)
      .insert(params.data as never)
      .select()
      .single();
    if (error) {
      throw toError(error);
    }
    return data as T;
  }

  async update<T>(resource: string, params: UpdateParams<T>): Promise<T> {
    // Same cast reason as create(): no typed Database schema to unify with T.
    const { data, error } = await this.client
      .from(resource)
      .update(params.data as never)
      .eq('id', params.id)
      .select()
      .single();
    if (error) {
      throw toError(error);
    }
    return data as T;
  }

  async delete<T>(resource: string, params: DeleteParams): Promise<T> {
    const { data, error } = await this.client
      .from(resource)
      .delete()
      .eq('id', params.id)
      .select()
      .single();
    if (error) {
      throw toError(error);
    }
    return data as T;
  }
}
