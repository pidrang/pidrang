import {
  ANON_KEY_PLACEHOLDER,
  PROJECT_URL_PLACEHOLDER,
  supabaseAppSetup,
} from './supabase-app-setup';
import { SupabaseConnection } from './supabase-connection';

const SECRET = 'secret-value-never-written';

const postgres = (host: string, user = 'postgres'): SupabaseConnection => ({
  strategy: 'postgres',
  host,
  port: 5432,
  database: 'postgres',
  user,
  password: SECRET,
});

describe('supabaseAppSetup', () => {
  it.each<[string, SupabaseConnection, string]>([
    [
      'graphql',
      { strategy: 'graphql', url: 'https://abc.supabase.co', anonKey: SECRET },
      'https://abc.supabase.co',
    ],
    [
      'service-role',
      {
        strategy: 'service-role',
        url: 'http://127.0.0.1:54321',
        serviceRoleKey: SECRET,
      },
      'http://127.0.0.1:54321',
    ],
    [
      'postgres on the direct host',
      postgres('db.abcdefgh.supabase.co'),
      'https://abcdefgh.supabase.co',
    ],
    [
      'postgres on the direct host in capitals',
      postgres('DB.ABCDEFGH.SUPABASE.CO'),
      'https://abcdefgh.supabase.co',
    ],
    [
      'postgres through the pooler',
      postgres('aws-0-eu-west-1.pooler.supabase.com', 'postgres.abcdefgh'),
      'https://abcdefgh.supabase.co',
    ],
  ])('writes the project URL it knows for %s', (_, connection, url) => {
    expect(supabaseAppSetup(connection).environment[0]).toEqual({
      name: 'supabaseUrl',
      value: url,
    });
  });

  it.each<[string, SupabaseConnection]>([
    ['a local database', postgres('127.0.0.1')],
    ['a self-hosted database', postgres('db.example.com')],
    [
      'the pooler with a user that names no project',
      postgres('aws-0-eu-west-1.pooler.supabase.com'),
    ],
    [
      'a pooler user on another host',
      postgres('db.example.com', 'postgres.abcdefgh'),
    ],
  ])('leaves a placeholder URL for %s', (_, connection) => {
    expect(supabaseAppSetup(connection).environment[0]).toMatchObject({
      name: 'supabaseUrl',
      value: PROJECT_URL_PLACEHOLDER,
    });
    expect(supabaseAppSetup(connection).environment[0].hint).toContain(
      'project URL',
    );
  });

  it.each<SupabaseConnection>([
    { strategy: 'graphql', url: 'https://abc.supabase.co', anonKey: SECRET },
    {
      strategy: 'service-role',
      url: 'https://abc.supabase.co',
      serviceRoleKey: SECRET,
    },
    postgres('db.abc.supabase.co'),
  ])(
    'leaves the anon key as a placeholder and writes no credential for $strategy',
    (connection) => {
      const setup = supabaseAppSetup(connection);

      expect(setup.environment[1]).toMatchObject({
        name: 'supabaseAnonKey',
        value: ANON_KEY_PLACEHOLDER,
      });
      expect(JSON.stringify(setup)).not.toContain(SECRET);
      expect(setup.notes.join(' ')).toContain('never the service role key');
    },
  );

  it('reads both values from the environment and registers both providers', () => {
    const setup = supabaseAppSetup(postgres('127.0.0.1'));

    expect(setup.constants).toEqual([
      {
        name: 'client',
        initializer:
          'createClient(environment.supabaseUrl, environment.supabaseAnonKey)',
      },
    ]);
    expect(setup.pidrangConfig).toEqual([
      {
        name: 'dataProvider',
        value: 'provideSupabaseDataProvider({ client })',
      },
      {
        name: 'authProvider',
        value: 'provideSupabaseAuthProvider({ client })',
      },
    ]);
    expect(setup.imports.map((entry) => entry.name)).toEqual([
      'providePidrang',
      'provideSupabaseAuthProvider',
      'provideSupabaseDataProvider',
      'createClient',
    ]);
  });
});
