import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { root, run } from '../shared.mjs';
import { MANIFEST } from './identities.mjs';
import { gateDirectory } from './paths.mjs';

const PLAN = 'tools/release-gate/generation-plan.json';
const PRIVATE_PLAN = 'tools/release-gate/generation-plan-private.json';
const LOCAL_API = 'http://127.0.0.1:54321';
const DEMOS = ['demo-material', 'demo-tailwind'];

const { values } = parseArgs({
  options: {
    mode: { type: 'string', default: 'build' },
    version: { type: 'string' },
  },
});

function fail(message) {
  console.error(`Release gate: ${message}`);
  process.exit(1);
}

function pack() {
  run('node', [
    'tools/release-gate/pack.mjs',
    ...(values.version ? ['--version', values.version] : []),
  ]);
  run('node', [
    '--test',
    'tools/release-gate/identities.test.mjs',
    'tools/release-gate/publishing.test.mjs',
    'tools/release-gate/spa-file.test.mjs',
  ]);
}

function build() {
  run('pnpm', ['exec', 'nx', 'run-many', '-t', 'build']);
}

function consumer(adapter, keys) {
  const backend = keys
    ? { url: keys.apiUrl, publishableKey: keys.publishableKey }
    : null;
  const privateAdapter = adapter === 'starter-private';
  run(
    'node',
    [
      'tools/release-gate/consumer.mjs',
      '--adapter',
      adapter,
      ...(adapter === 'tailwind'
        ? []
        : [
            '--plan',
            privateAdapter ? PRIVATE_PLAN : PLAN,
            '--generator',
            keys ? 'bin' : 'library',
          ]),
      ...(privateAdapter ? ['--reads-need-sign-in'] : []),
      ...(backend ? ['--backend', JSON.stringify(backend)] : []),
    ],
    keys
      ? {
          env: {
            ...process.env,
            PIDRANG_SUPABASE_SECRET_KEY: keys.secretKey,
          },
        }
      : undefined,
  );
}

function usePinnedCli(supabaseDirectory) {
  const version = readFileSync(
    join(supabaseDirectory, 'supabase/.cli-version'),
    'utf8',
  ).trim();
  const bin = mkdtempSync(join(tmpdir(), 'pidrang-gate-cli-'));
  const shim = join(bin, 'supabase');
  writeFileSync(shim, `#!/bin/sh\nexec npx -y supabase@${version} "$@"\n`);
  chmodSync(shim, 0o755);
  process.env['PATH'] = `${bin}${delimiter}${process.env['PATH']}`;
  const installed = execFileSync('supabase', ['--version'], {
    encoding: 'utf8',
  }).trim();
  if (installed !== version) {
    fail(`the supabase shim runs ${installed}, the fixtures pin ${version}`);
  }
}

function stackKeys(supabaseDirectory) {
  const output = execFileSync('supabase', ['status', '-o', 'env'], {
    cwd: supabaseDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const read = (name) => {
    const match = output.match(new RegExp(`^${name}="([^"]+)"$`, 'm'));
    if (!match) {
      fail(
        `the pinned Supabase CLI printed no ${name}: is the local stack running in ${supabaseDirectory}, started with that CLI?`,
      );
    }
    return match[1];
  };
  const keys = {
    apiUrl: read('API_URL'),
    publishableKey: read('PUBLISHABLE_KEY'),
    secretKey: read('SECRET_KEY'),
    serviceRoleKey: read('SERVICE_ROLE_KEY'),
  };
  if (keys.apiUrl !== LOCAL_API) {
    fail(
      `the local stack serves ${keys.apiUrl}, the gate expects ${LOCAL_API}`,
    );
  }
  return keys;
}

function checkDemoEnvironments(publishableKey) {
  for (const demo of DEMOS) {
    const path = `apps/${demo}/src/environments/environment.local.ts`;
    const source = readFileSync(resolve(root, path), 'utf8');
    if (
      !source.includes(`'${LOCAL_API}'`) ||
      !source.includes(`'${publishableKey}'`)
    ) {
      fail(
        `${path} does not point at ${LOCAL_API} with the running stack's publishable key`,
      );
    }
  }
}

function runConformance(keys) {
  const report = join(gateDirectory, 'conformance.json');
  run(
    'pnpm',
    [
      'exec',
      'nx',
      'test',
      'supabase',
      '--skip-nx-cache',
      '--reporters=default',
      '--reporters=json',
      `--outputFile=${report}`,
    ],
    {
      env: {
        ...process.env,
        PIDRANG_CONFORMANCE_SUPABASE_URL: keys.apiUrl,
        PIDRANG_CONFORMANCE_SUPABASE_KEY: keys.serviceRoleKey,
      },
    },
  );
  if (!existsSync(report)) {
    fail(`the conformance run wrote no report at ${report}`);
  }
  const results = JSON.parse(readFileSync(report, 'utf8'));
  if (!Array.isArray(results?.testResults)) {
    fail(`${report} has no testResults array`);
  }
  const conformance = results.testResults.filter(
    (file) =>
      typeof file?.name === 'string' &&
      file.name.endsWith('supabase-data-provider.conformance.spec.ts'),
  );
  for (const file of conformance) {
    if (!Array.isArray(file.assertionResults)) {
      fail(`${report}: ${file.name} has no assertionResults array`);
    }
  }
  const assertions = conformance.flatMap((file) => file.assertionResults);
  const notPassed = assertions.filter(
    (assertion) => assertion.status !== 'passed',
  );
  if (assertions.length === 0 || notPassed.length > 0) {
    fail(
      `the Supabase conformance suite ran ${assertions.length} test(s), ${notPassed.length} did not pass (${notPassed.map((assertion) => assertion.status).join(', ') || 'none ran'})`,
    );
  }
  console.log(
    `Supabase conformance: ${assertions.length} test(s) passed against ${keys.apiUrl}.`,
  );
  return assertions.length;
}

function updateManifest(change) {
  const manifestPath = join(gateDirectory, MANIFEST);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  change(manifest);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function checkFixturePin(supabaseDirectory) {
  const pinned = readFileSync(
    resolve(root, 'tools/release-gate/supabase-fixtures.ref'),
    'utf8',
  ).trim();
  const git = (args) =>
    execFileSync('git', args, {
      cwd: supabaseDirectory,
      encoding: 'utf8',
    }).trim();
  const head = git(['rev-parse', 'HEAD']);
  if (head !== pinned) {
    fail(
      `${supabaseDirectory} is at ${head}, tools/release-gate/supabase-fixtures.ref pins ${pinned}`,
    );
  }
  const changes = git(['status', '--porcelain']);
  if (changes !== '') {
    fail(`${supabaseDirectory} has local changes:\n${changes}`);
  }
  return head;
}

function recordFixtures(commit) {
  updateManifest((manifest) => {
    manifest.fixtures = { repository: 'pidrang/supabase', commit };
    manifest.browser = {
      playwright: JSON.parse(
        readFileSync(
          resolve(root, 'node_modules/@playwright/test/package.json'),
          'utf8',
        ),
      ).version,
    };
  });
}

rmSync(gateDirectory, { recursive: true, force: true });

if (values.mode === 'build') {
  build();
  pack();
  consumer('material');
  consumer('tailwind');
  updateManifest((manifest) => {
    manifest.gate = { mode: 'build', passed: true };
  });
  console.log(
    'Release gate (build): tarballs packed and checked, both consumers installed and built.',
  );
} else if (values.mode === 'full') {
  const supabaseDirectory = process.env['PIDRANG_SUPABASE_DIR'];
  if (!supabaseDirectory) {
    fail('PIDRANG_SUPABASE_DIR must point at a pidrang/supabase checkout');
  }
  const fixturesCommit = checkFixturePin(supabaseDirectory);
  usePinnedCli(supabaseDirectory);
  const keys = stackKeys(supabaseDirectory);
  checkDemoEnvironments(keys.publishableKey);
  run(join(supabaseDirectory, 'scripts/load-fixtures.sh'), ['--conformance']);

  build();
  pack();
  consumer('material', keys);
  consumer('tailwind', keys);
  consumer('starter', keys);
  consumer('starter-private', keys);
  recordFixtures(fixturesCommit);

  run(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      '-c',
      'tools/release-gate/playwright.config.mts',
    ],
    {
      env: {
        ...process.env,
        PIDRANG_GATE_SUITES: '',
        PIDRANG_PUBLISHABLE_KEY: keys.publishableKey,
      },
    },
  );
  run(join(supabaseDirectory, 'scripts/load-fixtures.sh'), ['--conformance']);
  const conformance = runConformance(keys);
  updateManifest((manifest) => {
    manifest.gate = {
      mode: 'full',
      passed: true,
      suites: [
        'consumer-material',
        'consumer-tailwind',
        'consumer-starter',
        'consumer-starter-private',
        'demo-material',
        'demo-tailwind',
      ],
      conformanceTests: conformance,
      finishedAt: new Date().toISOString(),
    };
  });
  const { source } = JSON.parse(
    readFileSync(join(gateDirectory, MANIFEST), 'utf8'),
  );
  const allowDirty = !source.clean && process.env['CI'] !== 'true';
  run('node', [
    'tools/release-gate/verify-identities.mjs',
    gateDirectory,
    ...(allowDirty ? ['--allow-dirty'] : []),
  ]);
  if (allowDirty) {
    console.log(
      'The working tree had changes when the tarballs were packed: this run cannot be published.',
    );
  }
  console.log(
    `Release gate passed. Tested tarballs and ${MANIFEST} are in ${gateDirectory}.`,
  );
} else {
  fail(`--mode must be build or full, not ${values.mode}`);
}
