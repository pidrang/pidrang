import { readFile } from 'node:fs/promises';
import { select, input, password, confirm } from '@inquirer/prompts';
import { supabaseSchemaProviderDefinition } from './supabase-schema-provider-definition';
import { createSupabaseSchemaProvider } from './supabase-schema-provider';
import { SupabaseConnectionError } from './supabase-connection-error';

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
  input: vi.fn(),
  password: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('./supabase-schema-provider', () => ({
  createSupabaseSchemaProvider: vi.fn(),
}));

describe('supabaseSchemaProviderDefinition', () => {
  const listTables = vi.fn();
  const URL = 'https://example.supabase.co';

  beforeEach(() => {
    vi.mocked(select).mockReset();
    vi.mocked(input).mockReset();
    vi.mocked(password).mockReset();
    vi.mocked(confirm).mockReset();
    vi.mocked(readFile).mockReset();
    listTables.mockReset().mockResolvedValue(['products']);
    vi.mocked(createSupabaseSchemaProvider)
      .mockReset()
      .mockReturnValue({ listTables, introspectTable: vi.fn() });
  });

  function messageOf(prompt: typeof input | typeof password, call: number) {
    return (vi.mocked(prompt).mock.calls[call][0] as { message: string })
      .message;
  }

  const rejectedKey = new SupabaseConnectionError(
    'rejected-key',
    'Supabase refused the service role key (401: Invalid API key).',
  );
  const graphQlDisabled = new SupabaseConnectionError(
    'graphql-disabled',
    'The pg_graphql extension is not enabled on this project.',
  );

  it('asks the project URL first, then offers the service role key by default', async () => {
    vi.mocked(input).mockResolvedValueOnce(URL);
    vi.mocked(select).mockResolvedValue('service-role');
    vi.mocked(password).mockResolvedValueOnce('secret-key');

    await supabaseSchemaProviderDefinition.promptConnection();

    expect(vi.mocked(input).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(select).mock.invocationCallOrder[0],
    );
    expect(messageOf(input, 0)).toBe('Supabase project URL:');
    const strategy = vi.mocked(select).mock.calls[0][0] as {
      message: string;
      default: string;
      choices: { name: string; value: string }[];
    };
    expect(strategy.message).not.toMatch(/introspect/i);
    expect(strategy.default).toBe('service-role');
    expect(strategy.choices.map((choice) => choice.value)).toEqual([
      'service-role',
      'postgres',
      'graphql',
    ]);
    expect(strategy.choices[2].name).toContain('requires pg_graphql');
  });

  it('prompts service-role-specific questions and says the key is never written', async () => {
    vi.mocked(input).mockResolvedValueOnce(URL);
    vi.mocked(select).mockResolvedValue('service-role');
    vi.mocked(password).mockResolvedValueOnce('secret-key');

    const connection =
      await supabaseSchemaProviderDefinition.promptConnection();

    expect(messageOf(password, 0)).toContain(
      'only used to read the schema and is never written to disk or into the app',
    );
    expect(connection).toEqual({
      strategy: 'service-role',
      url: URL,
      serviceRoleKey: 'secret-key',
    });
    expect(createSupabaseSchemaProvider).toHaveBeenCalledWith(connection);
    expect(listTables).toHaveBeenCalledTimes(1);
  });

  it('prompts graphql-specific questions when that strategy is chosen', async () => {
    vi.mocked(input).mockResolvedValueOnce(URL);
    vi.mocked(select).mockResolvedValue('graphql');
    vi.mocked(password).mockResolvedValueOnce('anon-key');

    const connection =
      await supabaseSchemaProviderDefinition.promptConnection();

    expect(connection).toEqual({
      strategy: 'graphql',
      url: URL,
      anonKey: 'anon-key',
    });
  });

  it.each(['service-role', 'graphql'])(
    'asks the %s key again with the reason when Supabase refuses it',
    async (strategy) => {
      vi.mocked(input).mockResolvedValueOnce(URL);
      vi.mocked(select).mockResolvedValue(strategy);
      vi.mocked(password)
        .mockResolvedValueOnce('wrong-key')
        .mockResolvedValueOnce('right-key');
      listTables.mockRejectedValueOnce(rejectedKey).mockResolvedValueOnce([]);

      const connection =
        await supabaseSchemaProviderDefinition.promptConnection();

      expect(password).toHaveBeenCalledTimes(2);
      expect(messageOf(password, 1)).toContain(rejectedKey.message);
      expect(connection).toMatchObject({ url: URL });
      expect(Object.values(connection)).toContain('right-key');
      expect(input).toHaveBeenCalledTimes(1);
    },
  );

  it('offers the service role key, keeping the URL, when pg_graphql is not enabled', async () => {
    vi.mocked(input).mockResolvedValueOnce(URL);
    vi.mocked(select).mockResolvedValue('graphql');
    vi.mocked(password)
      .mockResolvedValueOnce('anon-key')
      .mockResolvedValueOnce('secret-key');
    vi.mocked(confirm).mockResolvedValueOnce(true);
    listTables.mockRejectedValueOnce(graphQlDisabled).mockResolvedValueOnce([]);

    const connection =
      await supabaseSchemaProviderDefinition.promptConnection();

    const offer = vi.mocked(confirm).mock.calls[0][0] as {
      message: string;
      default: boolean;
    };
    expect(offer.message).toContain(graphQlDisabled.message);
    expect(offer.message).toContain('service role (secret) key instead?');
    expect(offer.default).toBe(true);
    expect(input).toHaveBeenCalledTimes(1);
    expect(connection).toEqual({
      strategy: 'service-role',
      url: URL,
      serviceRoleKey: 'secret-key',
    });
  });

  it('stops with the pg_graphql explanation when the offer is declined', async () => {
    vi.mocked(input).mockResolvedValueOnce(URL);
    vi.mocked(select).mockResolvedValue('graphql');
    vi.mocked(password).mockResolvedValueOnce('anon-key');
    vi.mocked(confirm).mockResolvedValueOnce(false);
    listTables.mockRejectedValueOnce(graphQlDisabled);

    await expect(
      supabaseSchemaProviderDefinition.promptConnection(),
    ).rejects.toBe(graphQlDisabled);
    expect(password).toHaveBeenCalledTimes(1);
  });

  it('lets any other connection failure through unchanged', async () => {
    const offline = new Error('fetch failed');
    vi.mocked(input).mockResolvedValueOnce(URL);
    vi.mocked(select).mockResolvedValue('service-role');
    vi.mocked(password).mockResolvedValueOnce('secret-key');
    listTables.mockRejectedValueOnce(offline);

    await expect(
      supabaseSchemaProviderDefinition.promptConnection(),
    ).rejects.toBe(offline);
    expect(password).toHaveBeenCalledTimes(1);
  });

  it('defaults TLS to on for a remote host, then reads the CA certificate file', async () => {
    vi.mocked(select).mockResolvedValue('postgres');
    vi.mocked(input)
      .mockResolvedValueOnce(URL)
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
      url: URL,
    });
    expect(createSupabaseSchemaProvider).not.toHaveBeenCalled();
  });

  it('defaults TLS to off for a local host, and omits ssl when declined', async () => {
    vi.mocked(select).mockResolvedValue('postgres');
    vi.mocked(input)
      .mockResolvedValueOnce('http://127.0.0.1:54321')
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
      url: 'http://127.0.0.1:54321',
    });
  });

  it('refuses a CA certificate file it cannot read', async () => {
    vi.mocked(select).mockResolvedValue('postgres');
    vi.mocked(input)
      .mockResolvedValueOnce(URL)
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
      .mockResolvedValueOnce(URL)
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
      url: URL,
    });
  });

  it.each([
    ['graphql', 'anonKey'],
    ['service-role', 'serviceRoleKey'],
  ])(
    'trims a %s key pasted with surrounding whitespace',
    async (strategy, keyName) => {
      vi.mocked(input).mockResolvedValueOnce(URL);
      vi.mocked(select).mockResolvedValue(strategy);
      vi.mocked(password).mockResolvedValueOnce('  pasted-key\n');

      const connection =
        await supabaseSchemaProviderDefinition.promptConnection();

      expect(connection).toMatchObject({ [keyName]: 'pasted-key' });
    },
  );

  it('drops trailing slashes from the project URL', async () => {
    vi.mocked(input).mockResolvedValueOnce(' https://example.supabase.co// ');
    vi.mocked(select).mockResolvedValue('service-role');
    vi.mocked(password).mockResolvedValueOnce('secret-key');

    const connection =
      await supabaseSchemaProviderDefinition.promptConnection();

    expect(connection).toMatchObject({ url: URL });
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
    vi.mocked(input).mockResolvedValueOnce(URL);
    vi.mocked(select).mockResolvedValue('graphql');
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
      .mockResolvedValueOnce(URL)
      .mockResolvedValueOnce('localhost')
      .mockResolvedValueOnce('5432')
      .mockResolvedValueOnce('postgres')
      .mockResolvedValueOnce('postgres');
    vi.mocked(password).mockResolvedValueOnce('postgres');
    vi.mocked(confirm).mockResolvedValueOnce(false);

    await supabaseSchemaProviderDefinition.promptConnection();

    expect(validatorOf(input, 1)('')).toBe('The database host is required');
    const port = validatorOf(input, 2);
    expect(port('5432')).toBe(true);
    expect(port('65535')).toBe(true);
    for (const invalid of ['', 'abc', '0', '65536', '54.3', '-1', '1e3']) {
      expect(port(invalid)).toContain('between 1 and 65535');
    }
    expect(validatorOf(input, 3)(' ')).toBe('The database name is required');
    expect(validatorOf(input, 4)('')).toBe('The database user is required');
  });
});

describe('supabaseSchemaProviderDefinition.connectionFromPlan', () => {
  const fromPlan = (connection: unknown, env: Record<string, string> = {}) =>
    supabaseSchemaProviderDefinition.connectionFromPlan(connection, env);

  async function problemOf(
    connection: unknown,
    env: Record<string, string> = {},
  ): Promise<string> {
    const error = await fromPlan(connection, env).then(
      () => null,
      (err: Error) => err,
    );
    if (!error) {
      throw new Error('expected the plan connection to be refused');
    }
    return error.message;
  }

  beforeEach(() => {
    vi.mocked(readFile).mockReset();
  });

  it.each([
    ['graphql', 'PIDRANG_SUPABASE_ANON_KEY', 'anonKey'],
    ['service-role', 'PIDRANG_SUPABASE_SERVICE_ROLE_KEY', 'serviceRoleKey'],
  ])(
    'reads a %s key from %s and normalizes the URL like the prompt',
    async (strategy, envName, keyName) => {
      expect(
        await fromPlan(
          { strategy, url: ' https://example.supabase.co// ' },
          { [envName]: '  pasted-key\n' },
        ),
      ).toEqual({
        strategy,
        url: 'https://example.supabase.co',
        [keyName]: 'pasted-key',
      });
    },
  );

  it.each([
    ['graphql', 'PIDRANG_SUPABASE_ANON_KEY'],
    ['service-role', 'PIDRANG_SUPABASE_SERVICE_ROLE_KEY'],
  ])(
    'asks for %s key in %s when it is missing or blank',
    async (strategy, envName) => {
      const connection = { strategy, url: 'https://example.supabase.co' };
      expect(await problemOf(connection)).toContain(`set ${envName}`);
      expect(await problemOf(connection, { [envName]: '  ' })).toContain(
        `set ${envName}`,
      );
    },
  );

  it.each([
    ['graphql', 'anonKey', 'PIDRANG_SUPABASE_ANON_KEY'],
    ['service-role', 'serviceRoleKey', 'PIDRANG_SUPABASE_SERVICE_ROLE_KEY'],
    ['postgres', 'password', 'PIDRANG_DATABASE_PASSWORD'],
  ])(
    'refuses a %s %s written in the plan file without repeating it',
    async (strategy, keyName, envName) => {
      const message = await problemOf(
        {
          strategy,
          url: 'https://example.supabase.co',
          host: 'db.example.com',
          [keyName]: 'leaked-secret',
        },
        { [envName]: 'from-env' },
      );
      expect(message).toContain(
        `${keyName} must not be in the plan file, set ${envName} instead`,
      );
      expect(message).not.toContain('leaked-secret');
      expect(message).not.toContain('from-env');
    },
  );

  it.each([
    ['no strategy', {}],
    ['an unknown strategy', { strategy: 'rest' }],
  ])('refuses a connection with %s', async (_, connection) => {
    expect(await problemOf(connection)).toContain(
      'strategy must be "graphql", "service-role" or "postgres"',
    );
  });

  it('refuses a connection that is not an object', async () => {
    expect(await problemOf('graphql')).toContain(
      'connection must be an object',
    );
  });

  it.each([
    ['a missing URL', undefined, 'url must be a string'],
    ['a URL that is not a string', 1, 'url must be a string'],
    [
      'a URL with a path',
      'https://example.supabase.co/rest/v1',
      'without /rest/v1',
    ],
    [
      'a URL with credentials',
      'https://u:p@example.supabase.co',
      'credentials',
    ],
  ])('refuses %s', async (_, url, message) => {
    expect(
      await problemOf(
        { strategy: 'graphql', url },
        { PIDRANG_SUPABASE_ANON_KEY: 'key' },
      ),
    ).toContain(message);
  });

  it('refuses a property the strategy does not use', async () => {
    expect(
      await problemOf(
        { strategy: 'graphql', url: 'https://example.supabase.co', host: 'x' },
        { PIDRANG_SUPABASE_ANON_KEY: 'key' },
      ),
    ).toContain('"host" is not a graphql connection property');
  });

  const password = { PIDRANG_DATABASE_PASSWORD: 'db-password' };

  it('defaults the port, database and user, and TLS on for a remote host', async () => {
    expect(
      await fromPlan(
        { strategy: 'postgres', host: ' db.example.com ' },
        password,
      ),
    ).toEqual({
      strategy: 'postgres',
      host: 'db.example.com',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'db-password',
      ssl: true,
    });
  });

  it.each(['localhost', '127.0.0.1', '::1'])(
    'defaults TLS off for %s and then leaves ssl out like the prompt',
    async (host) => {
      expect(await fromPlan({ strategy: 'postgres', host }, password)).toEqual({
        strategy: 'postgres',
        host,
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'db-password',
      });
    },
  );

  it('keeps TLS off when the plan says so for a remote host', async () => {
    expect(
      await fromPlan(
        { strategy: 'postgres', host: 'db.example.com', tls: false },
        password,
      ),
    ).not.toHaveProperty('ssl');
  });

  it('reads an optional project URL and normalizes it like the prompt', async () => {
    expect(
      await fromPlan(
        {
          strategy: 'postgres',
          host: 'localhost',
          url: ' http://127.0.0.1:54321/ ',
        },
        password,
      ),
    ).toMatchObject({ url: 'http://127.0.0.1:54321' });
    expect(
      await fromPlan({ strategy: 'postgres', host: 'localhost' }, password),
    ).not.toHaveProperty('url');
  });

  it('refuses a postgres project URL that is not one', async () => {
    expect(
      await problemOf(
        { strategy: 'postgres', host: 'localhost', url: 42 },
        password,
      ),
    ).toContain('url must be a string');
    expect(
      await problemOf(
        { strategy: 'postgres', host: 'localhost', url: 'nope' },
        password,
      ),
    ).toContain('Enter the project URL');
  });

  it('turns TLS on for a local host when the plan says so', async () => {
    expect(
      await fromPlan(
        { strategy: 'postgres', host: 'localhost', tls: true },
        password,
      ),
    ).toMatchObject({ ssl: true });
  });

  it.each([true, undefined])(
    'reads the CA certificate file when tls is %s',
    async (tls) => {
      vi.mocked(readFile).mockResolvedValueOnce('-----BEGIN CERTIFICATE-----');

      expect(
        await fromPlan(
          {
            strategy: 'postgres',
            host: 'localhost',
            port: 6543,
            database: 'mydb',
            user: 'me',
            tls,
            caCertificatePath: ' ca.crt ',
          },
          password,
        ),
      ).toEqual({
        strategy: 'postgres',
        host: 'localhost',
        port: 6543,
        database: 'mydb',
        user: 'me',
        password: 'db-password',
        ssl: { ca: '-----BEGIN CERTIFICATE-----' },
      });
      expect(readFile).toHaveBeenCalledWith('ca.crt', 'utf8');
    },
  );

  it('refuses a CA certificate file it cannot read', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT'));

    await expect(
      fromPlan(
        {
          strategy: 'postgres',
          host: 'db.example.com',
          caCertificatePath: 'x.crt',
        },
        password,
      ),
    ).rejects.toThrow('Could not read the CA certificate file at "x.crt".');
  });

  it('accepts an empty database password, like the prompt does', async () => {
    expect(
      await fromPlan(
        { strategy: 'postgres', host: 'localhost' },
        { PIDRANG_DATABASE_PASSWORD: '' },
      ),
    ).toMatchObject({ password: '' });
  });

  it.each([
    ['no host', { host: undefined }, 'host must be a non-empty string'],
    ['a blank host', { host: ' ' }, 'host must be a non-empty string'],
    ['a port as a string', { port: '5432' }, 'port must be a whole number'],
    ['a port of 0', { port: 0 }, 'port must be a whole number'],
    ['a port above 65535', { port: 65536 }, 'port must be a whole number'],
    ['a fractional port', { port: 54.3 }, 'port must be a whole number'],
    [
      'a blank database',
      { database: '' },
      'database must be a non-empty string',
    ],
    [
      'a user that is not a string',
      { user: 1 },
      'user must be a non-empty string',
    ],
    ['tls that is not a boolean', { tls: 'yes' }, 'tls must be true or false'],
    [
      'a blank CA path',
      { caCertificatePath: ' ' },
      'caCertificatePath must be a non-empty string',
    ],
    [
      'a CA path with tls off',
      { tls: false, caCertificatePath: 'ca.crt' },
      'caCertificatePath needs tls to be on',
    ],
  ])('refuses a postgres connection with %s', async (_, overrides, message) => {
    expect(
      await problemOf(
        { strategy: 'postgres', host: 'db.example.com', ...overrides },
        password,
      ),
    ).toContain(message);
    expect(readFile).not.toHaveBeenCalled();
  });

  it('asks for the database password when it is not set', async () => {
    expect(
      await problemOf({ strategy: 'postgres', host: 'db.example.com' }),
    ).toContain('set PIDRANG_DATABASE_PASSWORD');
  });

  it('lists every problem at once without reading the CA file', async () => {
    expect(
      await problemOf({
        strategy: 'postgres',
        port: 0,
        caCertificatePath: 'ca.crt',
      }),
    ).toBe(
      'Invalid connection in the plan: host must be a non-empty string; port must be a whole number between 1 and 65535; set PIDRANG_DATABASE_PASSWORD.',
    );
    expect(readFile).not.toHaveBeenCalled();
  });

  it('documents every variable it reads in its plan help', () => {
    for (const name of [
      'PIDRANG_SUPABASE_ANON_KEY',
      'PIDRANG_SUPABASE_SERVICE_ROLE_KEY',
      'PIDRANG_DATABASE_PASSWORD',
    ]) {
      expect(supabaseSchemaProviderDefinition.planHelp).toContain(name);
    }
  });
});
