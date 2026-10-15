import { TableIntrospection } from './table-introspection';

export interface SchemaProvider {
  listTables(): Promise<string[]>;

  introspectTable(table: string): Promise<TableIntrospection>;
}
