import { SchemaProvider } from '@pidrang/cli';
import { SupabaseConnection } from './supabase-connection';
import { createGraphQlSchemaProvider } from './graphql-schema-provider';
import { createServiceRoleSchemaProvider } from './service-role-schema-provider';
import { createPostgresSchemaProvider } from './postgres-schema-provider';
import { assertValidSupabaseConnection } from './assert-valid-supabase-connection';
import { normalizeProjectUrl } from './connection-problems';

function normalizeConnection(
  connection: SupabaseConnection,
): SupabaseConnection {
  switch (connection.strategy) {
    case 'graphql':
      return {
        ...connection,
        url: normalizeProjectUrl(connection.url),
        anonKey: connection.anonKey.trim(),
      };
    case 'service-role':
      return {
        ...connection,
        url: normalizeProjectUrl(connection.url),
        serviceRoleKey: connection.serviceRoleKey.trim(),
      };
    case 'postgres':
      return {
        ...connection,
        host: connection.host.trim(),
        database: connection.database.trim(),
        user: connection.user.trim(),
      };
    default:
      return connection;
  }
}

export function createSupabaseSchemaProvider(
  connection: SupabaseConnection,
): SchemaProvider {
  const normalized = normalizeConnection(connection);
  assertValidSupabaseConnection(normalized);
  switch (normalized.strategy) {
    case 'graphql':
      return createGraphQlSchemaProvider(normalized);
    case 'service-role':
      return createServiceRoleSchemaProvider(normalized);
    case 'postgres':
      return createPostgresSchemaProvider(normalized);
    default:
      throw new Error(
        `Unknown connection strategy: ${(normalized as SupabaseConnection).strategy}`,
      );
  }
}
