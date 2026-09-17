import { SchemaProvider } from './schema-provider';

export interface SchemaProviderDefinition<TConnection = unknown> {
  id: string;
  label: string;

  promptConnection(): Promise<TConnection>;

  createSchemaProvider(connection: TConnection): SchemaProvider;
}
