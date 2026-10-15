import { createSupabaseSchemaProvider } from './supabase-schema-provider';
import { createGraphQlSchemaProvider } from './graphql-schema-provider';
import { createServiceRoleSchemaProvider } from './service-role-schema-provider';
import { createPostgresSchemaProvider } from './postgres-schema-provider';
import { SupabaseConnection } from './supabase-connection';

vi.mock('./graphql-schema-provider', () => ({
  createGraphQlSchemaProvider: vi.fn(() => 'graphql-provider'),
}));
vi.mock('./service-role-schema-provider', () => ({
  createServiceRoleSchemaProvider: vi.fn(() => 'service-role-provider'),
}));
vi.mock('./postgres-schema-provider', () => ({
  createPostgresSchemaProvider: vi.fn(() => 'postgres-provider'),
}));

describe('createSupabaseSchemaProvider', () => {
  it('dispatches to the graphql provider', () => {
    const connection: SupabaseConnection = {
      strategy: 'graphql',
      url: 'https://example.supabase.co',
      anonKey: 'anon',
    };
    expect(createSupabaseSchemaProvider(connection)).toBe('graphql-provider');
    expect(createGraphQlSchemaProvider).toHaveBeenCalledWith(connection);
  });

  it('dispatches to the service-role provider', () => {
    const connection: SupabaseConnection = {
      strategy: 'service-role',
      url: 'https://example.supabase.co',
      serviceRoleKey: 'secret',
    };
    expect(createSupabaseSchemaProvider(connection)).toBe(
      'service-role-provider',
    );
    expect(createServiceRoleSchemaProvider).toHaveBeenCalledWith(connection);
  });

  it('dispatches to the postgres provider', () => {
    const connection: SupabaseConnection = {
      strategy: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres',
    };
    expect(createSupabaseSchemaProvider(connection)).toBe('postgres-provider');
    expect(createPostgresSchemaProvider).toHaveBeenCalledWith(connection);
  });

  it('passes the project URL without a trailing slash', () => {
    createSupabaseSchemaProvider({
      strategy: 'service-role',
      url: 'https://example.supabase.co/',
      serviceRoleKey: 'secret',
    });
    expect(createServiceRoleSchemaProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: 'https://example.supabase.co' }),
    );
  });

  it('normalizes the project URL before validating it', () => {
    createSupabaseSchemaProvider({
      strategy: 'graphql',
      url: ' https://example.supabase.co// ',
      anonKey: ' anon\n',
    });
    expect(createGraphQlSchemaProvider).toHaveBeenLastCalledWith({
      strategy: 'graphql',
      url: 'https://example.supabase.co',
      anonKey: 'anon',
    });
  });

  it('trims the postgres host, database and user, but never the password', () => {
    createSupabaseSchemaProvider({
      strategy: 'postgres',
      host: ' localhost ',
      port: 5432,
      database: ' postgres ',
      user: 'postgres\n',
      password: ' spaced password ',
    });
    expect(createPostgresSchemaProvider).toHaveBeenLastCalledWith({
      strategy: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: ' spaced password ',
    });
  });

  it.each<[string, SupabaseConnection, string]>([
    [
      'a graphql URL that is not a URL',
      { strategy: 'graphql', url: 'nope', anonKey: 'anon' },
      'Enter the project URL',
    ],
    [
      'an empty anon key',
      {
        strategy: 'graphql',
        url: 'https://example.supabase.co',
        anonKey: '',
      },
      'The anon key is required',
    ],
    [
      'an empty service role key',
      {
        strategy: 'service-role',
        url: 'https://example.supabase.co',
        serviceRoleKey: ' ',
      },
      'The service role key is required',
    ],
    [
      'a port that is not a number',
      {
        strategy: 'postgres',
        host: 'localhost',
        port: Number.NaN,
        database: 'postgres',
        user: 'postgres',
        password: 'postgres',
      },
      'between 1 and 65535',
    ],
    [
      'an empty host',
      {
        strategy: 'postgres',
        host: '',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'postgres',
      },
      'The database host is required',
    ],
    [
      'an empty CA certificate',
      {
        strategy: 'postgres',
        host: 'db.example.com',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'postgres',
        ssl: { ca: '' },
      },
      'The CA certificate is required',
    ],
  ])('refuses %s before creating a provider', (_, connection, message) => {
    vi.mocked(createGraphQlSchemaProvider).mockClear();
    vi.mocked(createServiceRoleSchemaProvider).mockClear();
    vi.mocked(createPostgresSchemaProvider).mockClear();
    expect(() => createSupabaseSchemaProvider(connection)).toThrow(message);
    expect(createGraphQlSchemaProvider).not.toHaveBeenCalled();
    expect(createServiceRoleSchemaProvider).not.toHaveBeenCalled();
    expect(createPostgresSchemaProvider).not.toHaveBeenCalled();
  });

  it('never repeats a secret in a validation error', () => {
    const error = (() => {
      try {
        createSupabaseSchemaProvider({
          strategy: 'postgres',
          host: '',
          port: 0,
          database: '',
          user: '',
          password: 'top-secret-password',
        });
      } catch (err) {
        return err as Error;
      }
      throw new Error('expected a validation error');
    })();
    expect(error.message).not.toContain('top-secret-password');
  });
});
