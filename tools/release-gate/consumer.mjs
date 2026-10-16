import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { root } from '../shared.mjs';
import { MANIFEST } from './identities.mjs';
import { gateDirectory } from './paths.mjs';

const OFFLINE_BACKEND = {
  url: 'http://127.0.0.1:54321',
  publishableKey: 'offline-build-only',
};

const GENERATORS = ['library', 'bin'];

const ADAPTERS = {
  material: {
    packages: [
      '@pidrang/core',
      '@pidrang/supabase',
      '@pidrang/material',
      '@pidrang/cli',
      '@pidrang/cli-supabase',
      'pidrang',
    ],
    dependencies: ['@angular/material', '@angular/cdk'],
    devDependencies: [],
  },
  tailwind: {
    packages: ['@pidrang/core', '@pidrang/supabase', '@pidrang/tailwind'],
    dependencies: [],
    devDependencies: ['tailwindcss', '@tailwindcss/postcss', 'postcss'],
  },
};

const COMMON_DEPENDENCIES = [
  '@angular/common',
  '@angular/compiler',
  '@angular/core',
  '@angular/forms',
  '@angular/platform-browser',
  '@angular/router',
  '@supabase/supabase-js',
  'rxjs',
  'tslib',
];

const COMMON_DEV_DEPENDENCIES = [
  '@angular/build',
  '@angular/cli',
  '@angular/compiler-cli',
  'typescript',
];

const { values } = parseArgs({
  options: {
    adapter: { type: 'string' },
    plan: { type: 'string' },
    generator: { type: 'string', default: 'library' },
    backend: { type: 'string' },
    'break-generated-import': { type: 'boolean', default: false },
    'drop-tailwind-source': { type: 'boolean', default: false },
    'drop-material-theme': { type: 'boolean', default: false },
    'drop-input-binding': { type: 'boolean', default: false },
  },
});

if (!GENERATORS.includes(values.generator)) {
  console.error(`--generator must be one of ${GENERATORS.join(', ')}`);
  process.exit(1);
}

const adapter = ADAPTERS[values.adapter];
if (!adapter) {
  console.error(`--adapter must be one of ${Object.keys(ADAPTERS).join(', ')}`);
  process.exit(1);
}

if (values.generator === 'bin' && !values.backend) {
  console.error('--generator bin needs --backend');
  process.exit(1);
}

if (
  values.generator === 'bin' &&
  !process.env['PIDRANG_SUPABASE_SERVICE_ROLE_KEY']
) {
  console.error(
    '--generator bin needs PIDRANG_SUPABASE_SERVICE_ROLE_KEY for the local stack',
  );
  process.exit(1);
}

const rootManifest = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8'),
);
const workspaceRanges = {
  ...rootManifest.devDependencies,
  ...rootManifest.dependencies,
};

function range(name) {
  const value = workspaceRanges[name];
  if (!value) {
    throw new Error(`${name} has no version in the root package.json`);
  }
  return value;
}

function execute(label, command, args, options) {
  console.log(`[${values.adapter}] ${label}`);
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 900_000,
    ...options,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  writeFileSync(join(output_directory, `${label}.log`), output);
  if (result.status !== 0) {
    console.error(output.trim().split('\n').slice(-40).join('\n'));
    throw new Error(
      `${values.adapter} consumer: ${label} failed (log: ${join(output_directory, `${label}.log`)})`,
    );
  }
  return output;
}

function readManifest() {
  return JSON.parse(readFileSync(join(gateDirectory, MANIFEST), 'utf8'));
}

function tarballFor(manifest, name) {
  const entry = manifest.tarballs.find((tarball) => tarball.name === name);
  if (!entry) {
    throw new Error(`${name} is not among the packed tarballs`);
  }
  return join(gateDirectory, 'tarballs', entry.file);
}

function installedVersion(consumer, name) {
  const path = join(consumer, 'node_modules', name, 'package.json');
  return existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8')).version
    : null;
}

function writeFile(base, path, content) {
  const target = join(base, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function generatedFiles(consumer, planPath) {
  const script = `
const { readFileSync } = require('node:fs');
const cli = require('@pidrang/cli');
const plan = JSON.parse(readFileSync(process.argv[1], 'utf8'));
process.stdout.write(JSON.stringify({
  resources: cli.generateResourcesFile(plan),
  routes: cli.RESOURCE_ROUTES_SNIPPET,
  pages: cli.generatePagesBundle(),
}));
`;
  const result = spawnSync('node', ['-e', script, resolve(planPath)], {
    cwd: consumer,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `${values.adapter} consumer: reading the installed @pidrang/cli failed: ${result.stderr.trim()}`,
    );
  }
  return JSON.parse(result.stdout);
}

function generateWithLibrary(consumer, planPath) {
  const generated = generatedFiles(consumer, planPath);
  const files = [
    { path: 'src/app/resources.ts', content: generated.resources },
    { path: 'src/app/resource-routes.ts', content: generated.routes },
    ...generated.pages,
  ];
  for (const file of files) {
    writeFile(consumer, file.path, file.content);
  }
  writeFileSync(
    join(output_directory, 'generate.log'),
    `${files.map((file) => file.path).join('\n')}\n`,
  );
}

function initPlanFrom(planPath, url) {
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  return {
    provider: plan.providerId,
    connection: { strategy: 'service-role', url },
    tables: plan.tables.map(({ table, actions, hiddenFields }) => ({
      table,
      actions,
      hiddenFields,
    })),
  };
}

function generateWithBin(consumer, planPath, url) {
  const initPlan = join(output_directory, 'init-plan.json');
  writeFileSync(
    initPlan,
    `${JSON.stringify(initPlanFrom(planPath, url), null, 2)}\n`,
  );
  execute(
    'init',
    join(consumer, 'node_modules/.bin/pidrang'),
    ['init', '--plan', initPlan],
    { cwd: consumer },
  );
  const generated = generatedFiles(consumer, planPath);
  const resources = readFileSync(
    join(consumer, 'src/app/resources.ts'),
    'utf8',
  );
  if (resources !== generated.resources) {
    writeFileSync(join(output_directory, 'resources.ts'), resources);
    throw new Error(
      `the installed pidrang bin generated another resources.ts from the local stack than ${planPath} describes: update ${planPath} to the introspected fields (the generated file is in ${output_directory}/resources.ts)`,
    );
  }
  writeFile(consumer, 'src/app/resource-routes.ts', generated.routes);
}

function breakGeneratedImport(consumer) {
  const page = join(consumer, 'src/app/pages/resource-list-page.ts');
  const source = readFileSync(page, 'utf8');
  const broken = source.replace(
    "from '../pidrang/index'",
    "from '../pidrang/missing'",
  );
  if (broken === source) {
    throw new Error('found no generated import to break');
  }
  writeFileSync(page, broken);
}

function checkTailwindClasses(site) {
  const expected = JSON.parse(
    readFileSync(
      resolve(root, 'tools/release-gate/tailwind-classes.json'),
      'utf8',
    ),
  );
  const css = readdirSync(site)
    .filter((file) => file.endsWith('.css'))
    .map((file) => readFileSync(join(site, file), 'utf8'))
    .join('\n');
  const missing = expected.filter((selector) => !css.includes(selector));
  if (missing.length > 0) {
    throw new Error(
      `the built Tailwind CSS has no rule for ${missing.join(', ')}: the installed @pidrang/tailwind classes were not generated`,
    );
  }
}

const output_directory = join(gateDirectory, 'consumers', values.adapter);
rmSync(output_directory, { recursive: true, force: true });
mkdirSync(output_directory, { recursive: true });

const manifest = readManifest();
const backend = values.backend ? JSON.parse(values.backend) : OFFLINE_BACKEND;
const consumer = mkdtempSync(join(tmpdir(), `pidrang-gate-${values.adapter}-`));

try {
  cpSync(
    resolve(root, 'tools/release-gate/consumers', values.adapter),
    consumer,
    { recursive: true },
  );
  if (values['drop-tailwind-source']) {
    const styles = join(consumer, 'src/styles.css');
    writeFileSync(
      styles,
      readFileSync(styles, 'utf8')
        .split('\n')
        .filter((line) => !line.startsWith('@source'))
        .join('\n'),
    );
  }
  if (values['drop-input-binding']) {
    const config = join(consumer, 'src/app/app.config.ts');
    const source = readFileSync(config, 'utf8');
    const dropped = source.replace(
      'provideRouter(appRoutes, withComponentInputBinding())',
      'provideRouter(appRoutes)',
    );
    if (dropped === source) {
      throw new Error('found no route input binding to drop');
    }
    writeFileSync(
      config,
      dropped
        .replace('withComponentInputBinding ', '')
        .replace(', withComponentInputBinding', ''),
    );
  }
  if (values['drop-material-theme']) {
    writeFileSync(join(consumer, 'src/styles.scss'), '');
  }

  const dependencies = Object.fromEntries(
    [...COMMON_DEPENDENCIES, ...adapter.dependencies].map((name) => [
      name,
      range(name),
    ]),
  );
  for (const name of adapter.packages) {
    dependencies[name] = `file:${tarballFor(manifest, name)}`;
  }
  const devDependencies = Object.fromEntries(
    [...COMMON_DEV_DEPENDENCIES, ...adapter.devDependencies].map((name) => [
      name,
      range(name),
    ]),
  );
  writeFileSync(
    join(consumer, 'package.json'),
    `${JSON.stringify({ name: `pidrang-gate-${values.adapter}`, private: true, dependencies, devDependencies }, null, 2)}\n`,
  );
  writeFile(
    consumer,
    'src/app/backend.ts',
    `export const backend = ${JSON.stringify(backend, null, 2)};\n`,
  );

  execute('install', 'npm', ['install', '--no-audit', '--no-fund'], {
    cwd: consumer,
  });
  cpSync(
    join(consumer, 'package-lock.json'),
    join(output_directory, 'package-lock.json'),
  );

  if (values.adapter === 'material') {
    if (!values.plan) {
      throw new Error('the material consumer needs --plan');
    }
    if (values.generator === 'bin') {
      generateWithBin(consumer, values.plan, backend.url);
    } else {
      generateWithLibrary(consumer, values.plan);
    }
    if (values['break-generated-import']) {
      breakGeneratedImport(consumer);
    }
  }

  execute('build', join(consumer, 'node_modules/.bin/ng'), ['build'], {
    cwd: consumer,
  });
  const site = join(output_directory, 'site');
  cpSync(join(consumer, 'dist/browser'), site, { recursive: true });
  if (values.adapter === 'tailwind') {
    checkTailwindClasses(site);
  }

  const recorded = readManifest();
  recorded.consumers[values.adapter] = {
    backend: backend.url,
    plan: values.plan ?? null,
    generator: values.adapter === 'material' ? values.generator : null,
    installed: Object.fromEntries(
      [
        ...COMMON_DEPENDENCIES,
        ...adapter.dependencies,
        ...COMMON_DEV_DEPENDENCIES,
        ...adapter.devDependencies,
        ...adapter.packages,
      ].map((name) => [name, installedVersion(consumer, name)]),
    ),
  };
  writeFileSync(
    join(gateDirectory, MANIFEST),
    `${JSON.stringify(recorded, null, 2)}\n`,
  );
  console.log(`[${values.adapter}] built into ${site}`);
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
