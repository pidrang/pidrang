import {
  addEnvironmentFileReplacements,
  environmentFileContent,
  environmentFiles,
  environmentImportPath,
  environmentLines,
  environmentPaths,
} from './edit-environments';

const ENTRIES = [
  { name: 'supabaseUrl', value: 'https://abc.supabase.co' },
  {
    name: 'supabasePublishableKey',
    value: 'YOUR-PUBLISHABLE-KEY',
    hint: 'the publishable key',
  },
];

describe('environment files', () => {
  it('writes one typed object with both values', () => {
    expect(environmentFileContent(ENTRIES)).toBe(`export const environment = {
  supabaseUrl: 'https://abc.supabase.co',
  supabasePublishableKey: 'YOUR-PUBLISHABLE-KEY',
};
`);
  });

  it('escapes what cannot go raw in a single-quoted string', () => {
    expect(
      environmentFileContent([{ name: 'value', value: "it's" }]),
    ).toContain("value: 'it\\'s',");
  });

  it('places the files next to the source root', () => {
    expect(environmentPaths('src')).toEqual({
      default: 'src/environments/environment.ts',
      development: 'src/environments/environment.development.ts',
    });
    expect(environmentPaths('projects/admin/src')).toEqual({
      default: 'projects/admin/src/environments/environment.ts',
      development: 'projects/admin/src/environments/environment.development.ts',
    });
  });

  it('imports the files from the app folder', () => {
    expect(environmentImportPath('src/app', 'src')).toBe(
      '../environments/environment',
    );
    expect(
      environmentImportPath('projects/admin/src/app', 'projects/admin/src'),
    ).toBe('../environments/environment');
  });

  it('writes the same content to both files', () => {
    const files = environmentFiles('src', ENTRIES);

    expect(files.map((file) => file.path)).toEqual([
      'src/environments/environment.ts',
      'src/environments/environment.development.ts',
    ]);
    expect(new Set(files.map((file) => file.content)).size).toBe(1);
  });

  it('lists only the values the environment file does not have yet', () => {
    expect(
      environmentLines(ENTRIES, 'export const environment = {};\n'),
    ).toEqual([
      "  supabaseUrl: 'https://abc.supabase.co',",
      "  supabasePublishableKey: 'YOUR-PUBLISHABLE-KEY', // the publishable key",
    ]);
    expect(
      environmentLines(
        ENTRIES,
        "export const environment = { supabaseUrl: 'x' };\n",
      ),
    ).toEqual([
      "  supabasePublishableKey: 'YOUR-PUBLISHABLE-KEY', // the publishable key",
    ]);
    expect(
      environmentLines(
        ENTRIES,
        "export const environment = { supabaseUrl: 'x', supabasePublishableKey: 'y' };\n",
      ),
    ).toEqual([]);
  });
});

describe('addEnvironmentFileReplacements', () => {
  const workspace = (architectKey = 'architect', extra = {}) =>
    JSON.stringify({
      projects: {
        shop: {
          projectType: 'application',
          sourceRoot: 'src',
          [architectKey]: {
            build: {
              defaultConfiguration: 'production',
              configurations: {
                production: { budgets: [] },
                development: { optimization: false, ...extra },
              },
            },
          },
        },
      },
    });

  const parse = (text: string | null) => JSON.parse(text ?? 'null');

  it('adds the development file to every configuration but the default one', () => {
    const result = addEnvironmentFileReplacements(workspace(), 'shop', 'src');

    expect(
      parse(result).projects.shop.architect.build.configurations.development
        .fileReplacements,
    ).toEqual([
      {
        replace: 'src/environments/environment.ts',
        with: 'src/environments/environment.development.ts',
      },
    ]);
    expect(
      parse(result).projects.shop.architect.build.configurations.production
        .fileReplacements,
    ).toBeUndefined();
  });

  it('also reads a workspace that uses targets', () => {
    const result = addEnvironmentFileReplacements(
      workspace('targets'),
      'shop',
      'src',
    );

    expect(
      parse(result).projects.shop.targets.build.configurations.development
        .fileReplacements,
    ).toHaveLength(1);
  });

  it('keeps the replacements the app already declares', () => {
    const result = addEnvironmentFileReplacements(
      workspace('architect', {
        fileReplacements: [
          { replace: 'src/other.ts', with: 'src/other.dev.ts' },
        ],
      }),
      'shop',
      'src',
    );

    expect(
      parse(result).projects.shop.architect.build.configurations.development
        .fileReplacements,
    ).toEqual([
      { replace: 'src/other.ts', with: 'src/other.dev.ts' },
      {
        replace: 'src/environments/environment.ts',
        with: 'src/environments/environment.development.ts',
      },
    ]);
  });

  it('makes no change when the replacement is already there', () => {
    const once = addEnvironmentFileReplacements(workspace(), 'shop', 'src');
    if (once === null) {
      throw new Error('expected a change');
    }

    expect(addEnvironmentFileReplacements(once, 'shop', 'src')).toBeNull();
  });

  it.each([
    ['invalid JSON', '{'],
    ['no project with that name', JSON.stringify({ projects: {} })],
    [
      'no build target',
      JSON.stringify({ projects: { shop: { architect: {} } } }),
    ],
    [
      'no configurations',
      JSON.stringify({ projects: { shop: { architect: { build: {} } } } }),
    ],
  ])('changes nothing for %s', (_, text) => {
    expect(addEnvironmentFileReplacements(text, 'shop', 'src')).toBeNull();
  });
});
