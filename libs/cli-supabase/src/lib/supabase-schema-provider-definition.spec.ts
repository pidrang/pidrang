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

  it('uses verified TLS with the system certificates when the CA path is left empty', async () => {
    vi.mocked(select).mockResolvedValue('postgres');
    vi.mocked(input)
      .mockResolvedValueOnce(' db.example.com ')
      .mockResolvedValueOnce(' 6543 ')
      .mockResolvedValueOnce(' mydb ')
      .mockResolvedValueOnce('myuser\n')
      .mockResolvedValueOnce('   ');
    vi.mocked(password).mockResolvedValueOnce('mypassword');
    vi.mocked(confirm).mockResolvedValueOnce(true);

    const connection =
      await supabaseSchemaProviderDefinition.promptConnection();

    expect(readFile).not.toHaveBeenCalled();
    expect(connection).toEqual({
      strategy: 'postgres',
      host: 'db.example.com',
      port: 6543,
      database: 'mydb',
      user: 'myuser',
      password: 'mypassword',
      ssl: true,
    });
  });

  it.each([
    ['graphql', 'anonKey'],
    ['service-role', 'serviceRoleKey'],
  ])(
    'trims a %s key pasted with surrounding whitespace',
    async (strategy, keyName) => {
      vi.mocked(select).mockResolvedValue(strategy);
      vi.mocked(input).mockResolvedValueOnce('https://example.supabase.co');
      vi.mocked(password).mockResolvedValueOnce('  pasted-key\n');

      const connection =
        await supabaseSchemaProviderDefinition.promptConnection();

      expect(connection).toMatchObject({ [keyName]: 'pasted-key' });
    },
  );

  it('drops trailing slashes from the project URL', async () => {
    vi.mocked(select).mockResolvedValue('service-role');
    vi.mocked(input).mockResolvedValueOnce(' https://example.supabase.co// ');
    vi.mocked(password).mockResolvedValueOnce('secret-key');

    const connection =
      await supabaseSchemaProviderDefinition.promptConnection();

    expect(connection).toMatchObject({ url: 'https://example.supabase.co' });
  });

  function validatorOf(
    prompt: typeof input | typeof password,
    call: number,
  ): (value: string) => string | boolean {
    const options = vi.mocked(prompt).mock.calls[call][0] as {
      validate?: (value: string) => string | boolean;
    };
    if (!options.validate) {
      throw new Error(`prompt ${call} has no validate option`);
    }
    return options.validate;
  }

  it('validates the project URL and the key before accepting them', async () => {
    vi.mocked(select).mockResolvedValue('graphql');
    vi.mocked(input).mockResolvedValueOnce('https://example.supabase.co');
    vi.mocked(password).mockResolvedValueOnce('anon-key');

    await supabaseSchemaProviderDefinition.promptConnection();

    const url = validatorOf(input, 0);
    expect(url('https://example.supabase.co')).toBe(true);
    expect(url('https://example.supabase.co/')).toBe(true);
    expect(url('http://127.0.0.1:54321')).toBe(true);
    expect(url('')).toContain('Enter the project URL');
    expect(url('example.supabase.co')).toContain('Enter the project URL');
    expect(url('ftp://example.supabase.co')).toContain('https://');
    expect(url('https://example.supabase.co/rest/v1')).toContain(
      'without /rest/v1',
    );
    expect(url('https://example.supabase.co?x=1')).toContain('query');
    expect(url('https://user:pw@example.supabase.co')).toContain('credentials');
    const key = validatorOf(password, 0);
    expect(key('anon-key')).toBe(true);
    expect(key('  ')).toBe('The anon key is required');
  });

  it('validates the database host, port, name and user', async () => {
    vi.mocked(select).mockResolvedValue('postgres');
    vi.mocked(input)
      .mockResolvedValueOnce('localhost')
      .mockResolvedValueOnce('5432')
      .mockResolvedValueOnce('postgres')
      .mockResolvedValueOnce('postgres');
    vi.mocked(password).mockResolvedValueOnce('postgres');
    vi.mocked(confirm).mockResolvedValueOnce(false);

    await supabaseSchemaProviderDefinition.promptConnection();

    expect(validatorOf(input, 0)('')).toBe('The database host is required');
    const port = validatorOf(input, 1);
    expect(port('5432')).toBe(true);
    expect(port('65535')).toBe(true);
    for (const invalid of ['', 'abc', '0', '65536', '54.3', '-1', '1e3']) {
      expect(port(invalid)).toContain('between 1 and 65535');
    }
    expect(validatorOf(input, 2)(' ')).toBe('The database name is required');
    expect(validatorOf(input, 3)('')).toBe('The database user is required');
  });
});
