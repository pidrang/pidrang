import { SchemaProvider } from '@pidrang/cli';
import { SupabaseConnection } from './supabase-connection';
import { createGraphQlSchemaProvider } from './graphql-schema-provider';
import { createServiceRoleSchemaProvider } from './service-role-schema-provider';
import { createPostgresSchemaProvider } from './postgres-schema-provider';

export function createSupabaseSchemaProvider(
  connection: SupabaseConnection,
): SchemaProvider {
  switch (connection.strategy) {
    case 'graphql':
      return createGraphQlSchemaProvider(connection);
    case 'service-role':
      return createServiceRoleSchemaProvider(connection);
    case 'postgres':
      return createPostgresSchemaProvider(connection);
    default:
      throw new Error(
        `Unknown connection strategy: ${(connection as SupabaseConnection).strategy}`,
      );
  }
}
