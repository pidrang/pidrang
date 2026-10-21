import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { root, tarballDirectory } from './shared.mjs';

const rootManifest = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8'),
);
const typescriptVersion = rootManifest.devDependencies.typescript;

const CONSUMER_SOURCE = `import { providePidrang, injectDataProvider, injectResourceList } from '@pidrang/core';
import { provideSupabaseAuthProvider, provideSupabaseDataProvider } from '@pidrang/supabase';
import { ResourceForm as MaterialForm, ResourceTable as MaterialTable } from '@pidrang/material';
import { ResourceForm as TailwindForm, ResourceTable as TailwindTable } from '@pidrang/tailwind';

export const used = [
  providePidrang,
  injectDataProvider,
  injectResourceList,
  provideSupabaseAuthProvider,
  provideSupabaseDataProvider,
  MaterialForm,
  MaterialTable,
  TailwindForm,
  TailwindTable,
];
`;

const CONSUMER_TSCONFIG = {
  compilerOptions: {
    target: 'es2022',
    module: 'esnext',
    moduleResolution: 'bundler',
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    experimentalDecorators: true,
  },
  files: ['check.ts'],
};

const problems = [];

function execute(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 300_000,
    ...options,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return { label, status: result.status, output };
}

function expect(condition, message, output = '') {
  if (!condition) {
    problems.push(output ? `${message}\n${output.trim()}` : message);
  }
}

const tarballs = readdirSync(tarballDirectory)
  .filter((file) => file.endsWith('.tgz'))
  .map((file) => join(tarballDirectory, file));

if (tarballs.length === 0) {
  console.error(`no tarball found in ${tarballDirectory}`);
  process.exit(1);
}

const consumer = mkdtempSync(join(tmpdir(), 'pidrang-consumer-'));

try {
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify(
      { name: 'consumer', private: true, type: 'module' },
      null,
      2,
    ),
  );

  const install = execute(
    'install',
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      ...tarballs,
      `typescript@${typescriptVersion}`,
    ],
    { cwd: consumer },
  );
  expect(
    install.status === 0,
    'npm install of the tarballs failed',
    install.output,
  );

  if (install.status === 0) {
    writeFileSync(join(consumer, 'check.ts'), CONSUMER_SOURCE);
    writeFileSync(
      join(consumer, 'tsconfig.json'),
      JSON.stringify(CONSUMER_TSCONFIG, null, 2),
    );
    const compile = execute(
      'compile',
      join(consumer, 'node_modules/.bin/tsc'),
      ['-p', '.'],
      {
        cwd: consumer,
      },
    );
    expect(
      compile.status === 0,
      'a consumer importing the four Angular packages does not compile',
      compile.output,
    );

    const runtime = execute(
      'runtime',
      'node',
      [
        '--input-type=module',
        '-e',
        "const core = await import('@pidrang/core'); const supabase = await import('@pidrang/supabase'); if (typeof core.providePidrang !== 'function' || typeof supabase.provideSupabaseDataProvider !== 'function') { process.exit(2); }",
      ],
      { cwd: consumer },
    );
    expect(
      runtime.status === 0,
      'core and supabase cannot be imported at runtime',
      runtime.output,
    );

    const cliLibraries = execute(
      'cli libraries',
      'node',
      [
        '-e',
        "const cli = require('@pidrang/cli'); const supabase = require('@pidrang/cli-supabase'); if (typeof cli.generatePagesBundle !== 'function' || !supabase.supabaseSchemaProviderDefinition) { process.exit(2); }",
      ],
      { cwd: consumer },
    );
    expect(
      cliLibraries.status === 0,
      'the CLI libraries cannot be required at runtime',
      cliLibraries.output,
    );

    const binary = join(consumer, 'node_modules/.bin/pidrang');
    const usage = execute('usage', binary, [], { cwd: consumer });
    expect(
      usage.status === 1 && usage.output.includes('Usage: pidrang init'),
      'the installed pidrang binary does not print its usage',
      usage.output,
    );

    const help = execute('help', binary, ['--help'], { cwd: consumer });
    expect(
      help.status === 0 &&
        help.output.includes('--plan <file>') &&
        help.output.includes('PIDRANG_SUPABASE_ANON_KEY'),
      'the installed pidrang binary does not print its help',
      help.output,
    );

    const emptyFolder = join(consumer, 'empty');
    mkdirSync(emptyFolder);
    const outsideApp = execute('init outside an app', binary, ['init'], {
      cwd: emptyFolder,
      input: '',
      timeout: 30_000,
    });
    expect(
      outsideApp.status === 1 &&
        outsideApp.output.includes('there is no angular.json here'),
      'the installed pidrang binary does not refuse a folder without angular.json',
      outsideApp.output,
    );
    expect(
      readdirSync(emptyFolder).length === 0,
      'init wrote files in a folder it cannot set up',
    );

    const app = join(consumer, 'app');
    const appFiles = {
      'angular.json': JSON.stringify({
        projects: { app: { projectType: 'application', sourceRoot: 'src' } },
      }),
      'package.json': JSON.stringify({
        dependencies: { '@angular/core': '^22.1.0' },
      }),
      'src/app/app.config.ts': 'export const appConfig = { providers: [] };\n',
      'src/app/app.routes.ts': 'export const routes = [];\n',
      'plan.json': JSON.stringify({
        provider: 'supabase',
        connection: { strategy: 'graphql', url: 'http://127.0.0.1:54321' },
        tables: [{ table: 'products', actions: ['list'] }],
      }),
    };
    for (const [path, content] of Object.entries(appFiles)) {
      mkdirSync(join(app, path, '..'), { recursive: true });
      writeFileSync(join(app, path), content);
    }
    const appEntries = () => readdirSync(app, { recursive: true }).sort();
    const before = JSON.stringify(appEntries());

    const init = execute('init', binary, ['init'], {
      cwd: app,
      input: '',
      timeout: 30_000,
    });
    expect(
      /Supabase project URL|Which data source/.test(init.output),
      'the installed pidrang binary does not start the init wizard',
      init.output,
    );
    expect(
      JSON.stringify(appEntries()) === before,
      'init wrote files before completing its prompts',
    );

    const envWithoutKey = { ...process.env };
    delete envWithoutKey.PIDRANG_SUPABASE_ANON_KEY;
    const scripted = execute(
      'init --plan without a key',
      binary,
      ['init', '--plan', 'plan.json'],
      { cwd: app, env: envWithoutKey, timeout: 30_000 },
    );
    expect(
      scripted.status === 1 &&
        scripted.output.includes('set PIDRANG_SUPABASE_ANON_KEY'),
      'the installed pidrang binary does not refuse a plan without its key',
      scripted.output,
    );
    expect(
      JSON.stringify(appEntries()) === before,
      'init --plan wrote files although the plan was refused',
    );
  }
} finally {
  rmSync(consumer, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error(`Install check failed with ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`\n- ${problem}`));
  process.exit(1);
}

console.log(
  'Install check passed: tarballs install together, compile, import and run.',
);
