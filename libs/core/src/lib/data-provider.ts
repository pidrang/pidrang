import { CreateParams, DeleteParams, GetOneParams, UpdateParams } from './crud-params';
import { ListParams, ListResult } from './list-params';

export interface DataProvider {
  getList<T>(resource: string, params?: ListParams): Promise<ListResult<T>>;

  getOne<T>(resource: string, params: GetOneParams): Promise<T>;

  create<T>(resource: string, params: CreateParams<T>): Promise<T>;

  update<T>(resource: string, params: UpdateParams<T>): Promise<T>;

  delete<T>(resource: string, params: DeleteParams): Promise<T>;
}
