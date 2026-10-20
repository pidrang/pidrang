import { AppSetup } from '@pidrang/cli';
import { PostgresConnection, SupabaseConnection } from './supabase-connection';

export const PROJECT_URL_PLACEHOLDER = 'https://YOUR-PROJECT-REF.supabase.co';
export const ANON_KEY_PLACEHOLDER = 'YOUR-SUPABASE-ANON-KEY';

const DIRECT_HOST = /^db\.([a-z0-9]+)\.supabase\.co$/i;
const POOLER_HOST = /\.pooler\.supabase\.com$/i;
const POOLER_USER = /^[a-z_]+\.([a-z0-9]+)$/i;

function projectUrlFromDatabase(connection: PostgresConnection): string | null {
  const direct = DIRECT_HOST.exec(connection.host);
  if (direct) {
    return `https://${direct[1].toLowerCase()}.supabase.co`;
  }
  const pooledUser = POOLER_USER.exec(connection.user);
  if (POOLER_HOST.test(connection.host) && pooledUser) {
    return `https://${pooledUser[1].toLowerCase()}.supabase.co`;
  }
  return null;
}

function projectUrl(connection: SupabaseConnection): string | null {
  return connection.strategy === 'postgres'
    ? projectUrlFromDatabase(connection)
    : connection.url;
}

export function supabaseAppSetup(connection: SupabaseConnection): AppSetup {
  const url = projectUrl(connection);
  return {
    imports: [
      { name: 'providePidrang', from: '@pidrang/core' },
      { name: 'provideSupabaseAuthProvider', from: '@pidrang/supabase' },
      { name: 'provideSupabaseDataProvider', from: '@pidrang/supabase' },
      { name: 'createClient', from: '@supabase/supabase-js' },
    ],
    constants: [
      {
        name: 'client',
        initializer:
          'createClient(environment.supabaseUrl, environment.supabaseAnonKey)',
      },
    ],
    pidrangConfig: [
      {
        name: 'dataProvider',
        value: 'provideSupabaseDataProvider({ client })',
      },
      {
        name: 'authProvider',
        value: 'provideSupabaseAuthProvider({ client })',
      },
    ],
    environment: [
      url === null
        ? {
            name: 'supabaseUrl',
            value: PROJECT_URL_PLACEHOLDER,
            hint: 'your project URL, from the Supabase dashboard: Project Settings, API',
          }
        : { name: 'supabaseUrl', value: url },
      {
        name: 'supabaseAnonKey',
        value: ANON_KEY_PLACEHOLDER,
        hint: 'the anon (publishable) key, from the Supabase dashboard: Project Settings, API',
      },
    ],
    notes: [
      'The app runs in the browser: give it the anon (publishable) key, never the service role key or the database password.',
    ],
  };
}
