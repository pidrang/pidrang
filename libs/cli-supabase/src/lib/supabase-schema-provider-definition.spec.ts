import { select, input, password, confirm } from '@inquirer/prompts';
import { supabaseSchemaProviderDefinition } from './supabase-schema-provider-definition';

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
  input: vi.fn(),
  password: vi.fn(),
  confirm: vi.fn(),
}));

describe('supabaseSchemaProviderDefinition', () => {
  beforeEach(() => {
    vi.mocked(select).mockReset();
    vi.mocked(input).mockReset();
    vi.mocked(password).mockReset();
    vi.mocked(confirm).mockReset();
  });

  it('prompts graphql-specific questions when that strategy is chosen', async () => {
    vi.mocked(select).mockResolvedValue('graphql');
    vi.mocked(input).mockResolvedValueOnce('https://example.supabase.co');
    vi.mocked(password).mockResolvedValueOnce('anon-key');

    const connection = await supabaseSchemaProviderDefinition.promptConnection();

    expect(connection).toEqual({
      strategy: 'graphql',
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });
  });

  it('prompts service-role-specific questions when that strategy is chosen', async () => {
    vi.mocked(select).mockResolvedValue('service-role');
    vi.mocked(input).mockResolvedValueOnce('https://example.supabase.co');
    vi.mocked(password).mockResolvedValueOnce('secret-key');

    const connection = await supabaseSchemaProviderDefinition.promptConnection();

    expect(connection).toEqual({
      strategy: 'service-role',
      url: 'https://example.supabase.co',
      serviceRoleKey: 'secret-key',
    });
  });

  it('prompts postgres-specific questions when that strategy is chosen, defaulting to TLS', async () => {
    vi.mocked(select).mockResolvedValue('postgres');
    vi.mocked(input)
      .mockResolvedValueOnce('db.example.com')
      .mockResolvedValueOnce('5433')
      .mockResolvedValueOnce('mydb')
      .mockResolvedValueOnce('myuser');
    vi.mocked(password).mockResolvedValueOnce('mypassword');
    vi.mocked(confirm).mockResolvedValueOnce(true);

    const connection = await supabaseSchemaProviderDefinition.promptConnection();

    expect(connection).toEqual({
      strategy: 'postgres',
      host: 'db.example.com',
      port: 5433,
      database: 'mydb',
      user: 'myuser',
      password: 'mypassword',
      ssl: true,
    });
  });

  it('omits ssl when the user declines TLS, for a local database', async () => {
    vi.mocked(select).mockResolvedValue('postgres');
    vi.mocked(input)
      .mockResolvedValueOnce('localhost')
      .mockResolvedValueOnce('5432')
      .mockResolvedValueOnce('postgres')
      .mockResolvedValueOnce('postgres');
    vi.mocked(password).mockResolvedValueOnce('postgres');
    vi.mocked(confirm).mockResolvedValueOnce(false);

    const connection = await supabaseSchemaProviderDefinition.promptConnection();

    expect(connection).toEqual({
      strategy: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres',
    });
  });
});
