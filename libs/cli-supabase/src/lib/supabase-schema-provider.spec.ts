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
});
