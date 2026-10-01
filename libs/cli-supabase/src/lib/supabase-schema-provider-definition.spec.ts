import { readFile } from 'node:fs/promises';
import { select, input, password, confirm } from '@inquirer/prompts';
import { supabaseSchemaProviderDefinition } from './supabase-schema-provider-definition';

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
  input: vi.fn(),
  password: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('supabaseSchemaProviderDefinition', () => {
  beforeEach(() => {
    vi.mocked(select).mockReset();
    vi.mocked(input).mockReset();
    vi.mocked(password).mockReset();
    vi.mocked(confirm).mockReset();
    vi.mocked(readFile).mockReset();
  });

  it('prompts graphql-specific questions when that strategy is chosen', async () => {
    vi.mocked(select).mockResolvedValue('graphql');
    vi.mocked(input).mockResolvedValueOnce('https://example.supabase.co');
    vi.mocked(password).mockResolvedValueOnce('anon-key');

    const connection =
      await supabaseSchemaProviderDefinition.promptConnection();

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

    const connection =
      await supabaseSchemaProviderDefinition.promptConnection();

    expect(connection).toEqual({
      strategy: 'service-role',
      url: 'https://example.supabase.co',
      serviceRoleKey: 'secret-key',
    });
  });

  it('defaults TLS to on for a remote host, then reads the CA certificate file', async () => {
    vi.mocked(select).mockResolvedValue('postgres');
    vi.mocked(input)
      .mockResolvedValueOnce('db.example.com')
      .mockResolvedValueOnce('5433')
      .mockResolvedValueOnce('mydb')
      .mockResolvedValueOnce('myuser')
      .mockResolvedValueOnce('/tmp/supabase-ca.crt');
    vi.mocked(password).mockResolvedValueOnce('mypassword');
    vi.mocked(confirm).mockResolvedValueOnce(true);
    vi.mocked(readFile).mockResolvedValueOnce(
      '-----BEGIN CERTIFICATE-----\n...',
    );

    const connection =
      await supabaseSchemaProviderDefinition.promptConnection();

    expect(vi.mocked(confirm).mock.calls[0][0]).toMatchObject({
      default: true,
    });
    expect(readFile).toHaveBeenCalledWith('/tmp/supabase-ca.crt', 'utf8');
    expect(connection).toEqual({
      strategy: 'postgres',
      host: 'db.example.com',
      port: 5433,
      database: 'mydb',
      user: 'myuser',
      password: 'mypassword',
      ssl: { ca: '-----BEGIN CERTIFICATE-----\n...' },
    });
  });

  it('defaults TLS to off for a local host, and omits ssl when declined', async () => {
    vi.mocked(select).mockResolvedValue('postgres');
    vi.mocked(input)
      .mockResolvedValueOnce('localhost')
      .mockResolvedValueOnce('5432')
      .mockResolvedValueOnce('postgres')
      .mockResolvedValueOnce('postgres');
    vi.mocked(password).mockResolvedValueOnce('postgres');
    vi.mocked(confirm).mockResolvedValueOnce(false);

    const connection =
      await supabaseSchemaProviderDefinition.promptConnection();

    expect(vi.mocked(confirm).mock.calls[0][0]).toMatchObject({
      default: false,
    });
    expect(readFile).not.toHaveBeenCalled();
    expect(connection).toEqual({
      strategy: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres',
    });
  });

  it('refuses a CA certificate file it cannot read', async () => {
    vi.mocked(select).mockResolvedValue('postgres');
    vi.mocked(input)
      .mockResolvedValueOnce('db.example.com')
      .mockResolvedValueOnce('5433')
      .mockResolvedValueOnce('mydb')
      .mockResolvedValueOnce('myuser')
      .mockResolvedValueOnce('/does/not/exist.crt');
    vi.mocked(password).mockResolvedValueOnce('mypassword');
    vi.mocked(confirm).mockResolvedValueOnce(true);
    vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT'));

    await expect(
      supabaseSchemaProviderDefinition.promptConnection(),
    ).rejects.toThrow('Could not read the CA certificate file');
  });
});
