import { readFile } from 'node:fs/promises';
import { select, input, password, confirm } from '@inquirer/prompts';
import { PlanEnvironment, SchemaProviderDefinition } from '@pidrang/cli';
import { PostgresSsl, SupabaseConnection } from './supabase-connection';
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

const ENV_ANON_KEY = 'PIDRANG_SUPABASE_ANON_KEY';
const ENV_SERVICE_ROLE_KEY = 'PIDRANG_SUPABASE_SERVICE_ROLE_KEY';
const ENV_DATABASE_PASSWORD = 'PIDRANG_DATABASE_PASSWORD';

const SECRETS_IN_ENV: Record<string, string> = {
  anonKey: ENV_ANON_KEY,
  serviceRoleKey: ENV_SERVICE_ROLE_KEY,
  password: ENV_DATABASE_PASSWORD,
};

const PLAN_KEYS: Record<SupabaseConnection['strategy'], string[]> = {
  graphql: ['strategy', 'url'],
  'service-role': ['strategy', 'url'],
  postgres: [
    'strategy',
    'host',
    'port',
    'database',
    'user',
    'tls',
    'caCertificatePath',
  ],
};

const PLAN_HELP = `Supabase plan connection, one of:
  { "strategy": "graphql", "url": "https://<ref>.supabase.co" }
      key from ${ENV_ANON_KEY}
  { "strategy": "service-role", "url": "https://<ref>.supabase.co" }
      key from ${ENV_SERVICE_ROLE_KEY}
  { "strategy": "postgres", "host": "db.<ref>.supabase.co", "port": 5432,
    "database": "postgres", "user": "postgres", "tls": true,
    "caCertificatePath": "prod-ca.crt" }
      password from ${ENV_DATABASE_PASSWORD}; port, database, user, tls and
      caCertificatePath are optional, tls defaults to on for a remote host`;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidPlanConnection(problems: string[]): Error {
  return new Error(`Invalid connection in the plan: ${problems.join('; ')}.`);
}

function secretFromEnv(
  env: PlanEnvironment,
  name: string,
  problems: string[],
): string {
  const value = env[name]?.trim() ?? '';
  if (value === '') {
    problems.push(`set ${name}`);
  }
  return value;
}

function planUrl(
  connection: Record<string, unknown>,
  problems: string[],
): string {
  if (typeof connection['url'] !== 'string') {
    problems.push('url must be a string');
    return '';
  }
  const url = normalizeProjectUrl(connection['url']);
  const problem = projectUrlProblem(url);
  if (problem) {
    problems.push(problem);
  }
  return url;
}

function planText(
  connection: Record<string, unknown>,
  key: string,
  fallback: string | null,
  problems: string[],
): string {
  const value = connection[key];
  if (value === undefined && fallback !== null) {
    return fallback;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    problems.push(`${key} must be a non-empty string`);
    return '';
  }
  return value.trim();
}

function planPort(
  connection: Record<string, unknown>,
  problems: string[],
): number {
  const value = connection['port'];
  if (value === undefined) {
    return 5432;
  }
  if (typeof value !== 'number' || portProblem(String(value))) {
    problems.push('port must be a whole number between 1 and 65535');
    return 0;
  }
  return value;
}

async function planSsl(
  connection: Record<string, unknown>,
  host: string,
  problems: string[],
): Promise<PostgresSsl | undefined> {
  const tls = connection['tls'];
  const caPath = connection['caCertificatePath'];
  if (tls !== undefined && typeof tls !== 'boolean') {
    problems.push('tls must be true or false');
    return undefined;
  }
  if (
    caPath !== undefined &&
    (typeof caPath !== 'string' || caPath.trim() === '')
  ) {
    problems.push('caCertificatePath must be a non-empty string');
    return undefined;
  }
  if (tls === false && caPath !== undefined) {
    problems.push('caCertificatePath needs tls to be on');
    return undefined;
  }
  const useTls = tls ?? (caPath !== undefined || !LOCAL_HOSTS.has(host));
  if (!useTls) {
    return undefined;
  }
  if (caPath === undefined || problems.length > 0) {
    return true;
  }
  return { ca: await readCaCertificate(caPath.trim()) };
}

async function connectionFromPlan(
  connection: unknown,
  env: PlanEnvironment,
): Promise<SupabaseConnection> {
  if (!isObject(connection)) {
    throw invalidPlanConnection(['connection must be an object']);
  }
  const strategy = connection['strategy'];
  if (
    strategy !== 'graphql' &&
    strategy !== 'service-role' &&
    strategy !== 'postgres'
  ) {
    throw invalidPlanConnection([
      'strategy must be "graphql", "service-role" or "postgres"',
    ]);
  }
  const problems = Object.keys(connection)
    .filter((key) => !PLAN_KEYS[strategy].includes(key))
    .map((key) =>
      SECRETS_IN_ENV[key]
        ? `${key} must not be in the plan file, set ${SECRETS_IN_ENV[key]} instead`
        : `${JSON.stringify(key)} is not a ${strategy} connection property`,
    );

  switch (strategy) {
    case 'graphql': {
      const url = planUrl(connection, problems);
      const anonKey = secretFromEnv(env, ENV_ANON_KEY, problems);
      if (problems.length > 0) {
        throw invalidPlanConnection(problems);
      }
      return { strategy, url, anonKey };
    }
    case 'service-role': {
      const url = planUrl(connection, problems);
      const serviceRoleKey = secretFromEnv(env, ENV_SERVICE_ROLE_KEY, problems);
      if (problems.length > 0) {
        throw invalidPlanConnection(problems);
      }
      return { strategy, url, serviceRoleKey };
    }
    case 'postgres': {
      const host = planText(connection, 'host', null, problems);
      const port = planPort(connection, problems);
      const database = planText(connection, 'database', 'postgres', problems);
      const user = planText(connection, 'user', 'postgres', problems);
      const dbPassword = env[ENV_DATABASE_PASSWORD];
      if (dbPassword === undefined) {
        problems.push(`set ${ENV_DATABASE_PASSWORD}`);
      }
      const ssl = await planSsl(connection, host, problems);
      if (problems.length > 0) {
        throw invalidPlanConnection(problems);
      }
      const base: SupabaseConnection = {
        strategy,
        host,
        port,
        database,
        user,
        password: dbPassword ?? '',
      };
      return ssl === undefined ? base : { ...base, ssl };
    }
  }
}

export const supabaseSchemaProviderDefinition: SchemaProviderDefinition<SupabaseConnection> =
  {
    id: 'supabase',
    label: 'Supabase',
    planHelp: PLAN_HELP,

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

    connectionFromPlan,

    createSchemaProvider(connection) {
      return createSupabaseSchemaProvider(connection);
    },
  };
