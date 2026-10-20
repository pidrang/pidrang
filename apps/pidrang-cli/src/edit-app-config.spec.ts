import { AppSetup } from '@pidrang/cli';
import * as typescript from 'typescript';
import { ConfigRequest, editAppConfig } from './edit-app-config';

const SETUP: AppSetup = {
  imports: [
    { name: 'providePidrang', from: '@pidrang/core' },
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
    { name: 'dataProvider', value: 'provideSupabaseDataProvider({ client })' },
  ],
  environment: [],
  notes: [],
};

const REQUEST: ConfigRequest = {
  setup: SETUP,
  environmentImport: '../environments/environment',
  resourcesImport: './resources',
};

const STOCK = `import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes)
  ]
};
`;

const edit = (source: string, request: ConfigRequest = REQUEST) =>
  editAppConfig(typescript, 'src/app/app.config.ts', source, request);

const edited = (source: string, request: ConfigRequest = REQUEST) => {
  const result = edit(source, request);
  if (result.kind !== 'edited') {
    throw new Error(`expected an edit, got ${result.kind}`);
  }
  return result.content;
};

describe('editAppConfig', () => {
  it('adds the imports, the client, the pidrang provider and input binding to a stock app', () => {
    expect(edited(STOCK))
      .toBe(`import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePidrang } from '@pidrang/core';
import { createClient } from '@supabase/supabase-js';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { resources } from './resources';

const client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    providePidrang({
      dataProvider: provideSupabaseDataProvider({ client }),
      resources,
    })
  ]
};
`);
  });

  it('leaves a file that already binds inputs and registers pidrang alone', () => {
    const source = edited(STOCK);

    expect(edit(source)).toEqual({ kind: 'unchanged' });
  });

  it('adds only pidrang when the router already binds component inputs', () => {
    const source = STOCK.replace(
      'provideRouter(routes)',
      'provideRouter(routes, withComponentInputBinding())',
    );
    const result = edited(source);

    expect(result).not.toContain('withComponentInputBinding());');
    expect(result.match(/withComponentInputBinding\(\)/g)).toHaveLength(1);
    expect(result).toContain("import { providePidrang } from '@pidrang/core';");
  });

  it('adds only the binding when pidrang is already registered', () => {
    const source = STOCK.replace(
      'provideRouter(routes)',
      `provideRouter(routes),
    providePidrang({ dataProvider, resources })`,
    );
    const source2 = source.replace(
      "import { routes } from './app.routes';",
      `import { providePidrang } from '@pidrang/core';
import { dataProvider } from './data';
import { resources } from './resources';
import { routes } from './app.routes';`,
    );
    const result = edited(source2);

    expect(result).toContain(
      'provideRouter(routes, withComponentInputBinding())',
    );
    expect(result.match(/providePidrang\(/g)).toHaveLength(1);
  });

  it('keeps the other router features next to the binding', () => {
    const source = STOCK.replace(
      'provideRouter(routes)',
      'provideRouter(routes, withInMemoryScrolling(), withComponentInputBinding()),',
    );

    expect(edited(source)).toContain(
      'provideRouter(routes, withInMemoryScrolling(), withComponentInputBinding()),',
    );
    expect(edit(edited(source))).toEqual({ kind: 'unchanged' });
  });

  it.each([
    [
      'no provideRouter',
      STOCK.replace('provideRouter(routes)', 'routerProviders'),
    ],
    [
      'providers that are not an array',
      STOCK.replace(/providers: \[[\s\S]*\]/, 'providers: sharedProviders'),
    ],
    [
      'several application configs with no appConfig',
      STOCK.replace('export const appConfig', 'export const firstConfig') +
        'export const otherConfig: ApplicationConfig = { providers: [] };\n',
    ],
    [
      'a provider name already used for something else',
      STOCK.replace(
        "import { routes } from './app.routes';",
        `import { routes } from './app.routes';

const client = 'something else';`,
      ),
    ],
  ])('writes a comment when there is %s', (_, source) => {
    const result = edit(source);

    expect(result.kind).toBe('manual');
    if (result.kind !== 'manual') {
      return;
    }
    expect(result.content.startsWith('// pidrang:')).toBe(true);
    expect(result.content).toContain(
      "import { providePidrang } from '@pidrang/core';",
    );
    expect(result.content).toContain(
      'provideRouter(routes, withComponentInputBinding())',
    );
    expect(result.content.endsWith(source)).toBe(true);
    expect(edit(result.content)).toEqual({ kind: 'unchanged' });
  });

  it('writes no environment import when the app has no environment files', () => {
    const result = edited(STOCK, { ...REQUEST, environmentImport: null });

    expect(result).not.toContain('environments/environment');
    expect(result).toContain(
      'createClient(environment.supabaseUrl, environment.supabaseAnonKey)',
    );
  });

  it('does not duplicate an import that is already there', () => {
    const result = edited(
      STOCK.replace(
        "import { routes } from './app.routes';",
        `import { providePidrang } from '@pidrang/core';
import { routes } from './app.routes';`,
      ),
    );

    expect(result.match(/import \{ providePidrang \}/g)).toHaveLength(1);
  });

  it('follows the indentation of the file', () => {
    const source = `import { provideRouter } from '@angular/router';

export const appConfig = {
	providers: [
		provideRouter(routes),
	],
};
`;

    expect(edited(source)).toContain('\n\t\tprovidePidrang({');
  });

  it('writes a comment when TypeScript is not installed in the app', () => {
    const result = editAppConfig(null, 'src/app/app.config.ts', STOCK, REQUEST);

    expect(result.kind).toBe('manual');
    if (result.kind === 'manual') {
      expect(result.reason).toBe('TypeScript is not installed in this app');
      expect(result.content.startsWith('// pidrang:')).toBe(true);
    }
  });
});
