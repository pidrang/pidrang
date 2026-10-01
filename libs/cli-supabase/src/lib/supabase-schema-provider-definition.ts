import { select, input, password, confirm } from '@inquirer/prompts';
import { SchemaProviderDefinition } from '@pidrang/cli';
import { SupabaseConnection } from './supabase-connection';
import { createSupabaseSchemaProvider } from './supabase-schema-provider';

async function promptGraphQlConnection(): Promise<SupabaseConnection> {
  const url = await input({ message: 'Supabase project URL:' });
  const anonKey = await password({ message: 'Anon / publishable key:' });
  return { strategy: 'graphql', url, anonKey };
}

async function promptServiceRoleConnection(): Promise<SupabaseConnection> {
  const url = await input({ message: 'Supabase project URL:' });
  const serviceRoleKey = await password({
    message: 'Service role (secret) key:',
  });
  return { strategy: 'service-role', url, serviceRoleKey };
}

async function promptPostgresConnection(): Promise<SupabaseConnection> {
  const host = await input({ message: 'Database host:' });
  const port = Number(await input({ message: 'Database port:', default: '5432' }));
  const database = await input({
    message: 'Database name:',
    default: 'postgres',
  });
  const user = await input({ message: 'Database user:', default: 'postgres' });
  const dbPassword = await password({ message: 'Database password:' });
  const ssl = await confirm({
    message: 'Connect over TLS? (required for a hosted database)',
    default: true,
  });
  return {
    strategy: 'postgres',
    host,
    port,
    database,
    user,
    password: dbPassword,
    ...(ssl ? { ssl: true as const } : {}),
  };
}

export const supabaseSchemaProviderDefinition: SchemaProviderDefinition<SupabaseConnection> =
  {
    id: 'supabase',
    label: 'Supabase',

    async promptConnection() {
      const strategy = await select<SupabaseConnection['strategy']>({
        message: 'How should pidrang introspect your Supabase database?',
        choices: [
          {
            name: 'GraphQL introspection (requires pg_graphql to be enabled)',
            value: 'graphql',
          },
          {
            name: 'Service role key (uses the REST OpenAPI schema)',
            value: 'service-role',
          },
          {
            name: 'Direct database connection (host/user/password)',
            value: 'postgres',
          },
        ],
      });

      switch (strategy) {
        case 'graphql':
          return promptGraphQlConnection();
        case 'service-role':
          return promptServiceRoleConnection();
        case 'postgres':
          return promptPostgresConnection();
        default:
          throw new Error(`Unknown connection strategy: ${strategy}`);
      }
    },

    createSchemaProvider(connection) {
      return createSupabaseSchemaProvider(connection);
    },
  };
