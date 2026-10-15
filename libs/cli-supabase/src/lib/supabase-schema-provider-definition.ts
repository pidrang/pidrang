import { readFile } from 'node:fs/promises';
import { select, input, password, confirm } from '@inquirer/prompts';
import { SchemaProviderDefinition } from '@pidrang/cli';
import { SupabaseConnection } from './supabase-connection';
import { createSupabaseSchemaProvider } from './supabase-schema-provider';
import {
  normalizeProjectUrl,
  portProblem,
  projectUrlProblem,
  requiredValueProblem,
} from './connection-problems';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

async function readCaCertificate(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    throw new Error(`Could not read the CA certificate file at "${path}".`);
  }
}

function required(label: string): (value: string) => string | true {
  return (value) => requiredValueProblem(label, value) ?? true;
}

async function promptProjectUrl(): Promise<string> {
  const url = await input({
    message: 'Supabase project URL:',
    validate: (value) => projectUrlProblem(normalizeProjectUrl(value)) ?? true,
  });
  return normalizeProjectUrl(url);
}

async function promptGraphQlConnection(): Promise<SupabaseConnection> {
  const url = await promptProjectUrl();
  const anonKey = (
    await password({
      message: 'Anon / publishable key:',
      validate: required('The anon key'),
    })
  ).trim();
  return { strategy: 'graphql', url, anonKey };
}

async function promptServiceRoleConnection(): Promise<SupabaseConnection> {
  const url = await promptProjectUrl();
  const serviceRoleKey = (
    await password({
      message: 'Service role (secret) key:',
      validate: required('The service role key'),
    })
  ).trim();
  return { strategy: 'service-role', url, serviceRoleKey };
}

async function promptPostgresConnection(): Promise<SupabaseConnection> {
  const host = (
    await input({
      message: 'Database host:',
      validate: required('The database host'),
    })
  ).trim();
  const port = Number(
    (
      await input({
        message: 'Database port:',
        default: '5432',
        validate: (value) => portProblem(value) ?? true,
      })
    ).trim(),
  );
  const database = (
    await input({
      message: 'Database name:',
      default: 'postgres',
      validate: required('The database name'),
    })
  ).trim();
  const user = (
    await input({
      message: 'Database user:',
      default: 'postgres',
      validate: required('The database user'),
    })
  ).trim();
  const dbPassword = await password({ message: 'Database password:' });
  const useTls = await confirm({
    message: 'Connect over TLS? (required for a hosted database)',
    default: !LOCAL_HOSTS.has(host),
  });
  if (!useTls) {
    return {
      strategy: 'postgres',
      host,
      port,
      database,
      user,
      password: dbPassword,
    };
  }
  const caPath = (
    await input({
      message:
        'Path to the CA certificate file (Supabase dashboard: Database settings > SSL > Download certificate). Leave empty to trust the system certificates only:',
    })
  ).trim();
  const ssl = caPath === '' ? true : { ca: await readCaCertificate(caPath) };
  return {
    strategy: 'postgres',
    host,
    port,
    database,
    user,
    password: dbPassword,
    ssl,
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
