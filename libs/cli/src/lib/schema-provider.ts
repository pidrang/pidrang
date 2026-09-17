import { Field } from '@pidrang/core';

export interface SchemaProvider {
  listTables(): Promise<string[]>;

  introspectTable(table: string): Promise<Field[]>;
}
