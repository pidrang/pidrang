import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  compareTarballs,
  describeTarballs,
  expectationProblems,
  gateProblems,
  packageProblems,
} from './identities.mjs';

let work;

function pack(directory, file, version) {
  const source = join(work, 'source', file);
  mkdirSync(join(source, 'package'), { recursive: true });
  writeFileSync(
    join(source, 'package', 'package.json'),
    JSON.stringify({ name: '@pidrang/probe', version }),
  );
  execFileSync('tar', ['-czf', join(directory, file), '-C', source, 'package']);
}

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'pidrang-identities-'));
  mkdirSync(join(work, 'tested'));
  mkdirSync(join(work, 'published'));
  pack(join(work, 'tested'), 'probe-1.0.0.tgz', '1.0.0');
});

afterEach(() => rmSync(work, { recursive: true, force: true }));

test('accepts the exact tarballs the gate tested', () => {
  copyFileSync(
    join(work, 'tested', 'probe-1.0.0.tgz'),
    join(work, 'published', 'probe-1.0.0.tgz'),
  );
  const tested = describeTarballs(join(work, 'tested'));
  assert.equal(tested[0].name, '@pidrang/probe');
  assert.equal(tested[0].version, '1.0.0');
  assert.deepEqual(
    compareTarballs(tested, describeTarballs(join(work, 'published'))),
    [],
  );
});

test('rejects a tarball whose bytes changed', () => {
  copyFileSync(
    join(work, 'tested', 'probe-1.0.0.tgz'),
    join(work, 'published', 'probe-1.0.0.tgz'),
  );
  const published = join(work, 'published', 'probe-1.0.0.tgz');
  const bytes = readFileSync(published);
  bytes[4] ^= 0xff;
  writeFileSync(published, bytes);
  const problems = compareTarballs(
    describeTarballs(join(work, 'tested')),
    describeTarballs(join(work, 'published')),
  );
  assert.ok(problems.some((problem) => problem.includes('sha256')));
});

test('rejects a repacked tarball with another version', () => {
  pack(join(work, 'published'), 'probe-1.0.0.tgz', '1.0.1');
  const problems = compareTarballs(
    describeTarballs(join(work, 'tested')),
    describeTarballs(join(work, 'published')),
  );
  assert.ok(problems.some((problem) => problem.includes('version is 1.0.1')));
});

test('rejects a missing tarball and one the gate never tested', () => {
  pack(join(work, 'published'), 'other-1.0.0.tgz', '1.0.0');
  assert.deepEqual(
    compareTarballs(
      describeTarballs(join(work, 'tested')),
      describeTarballs(join(work, 'published')),
    ),
    ['probe-1.0.0.tgz: missing', 'other-1.0.0.tgz: not tested by the gate'],
  );
});

const clean = { commit: 'abc', clean: true };

test('accepts only a manifest whose full gate passed', () => {
  assert.deepEqual(
    gateProblems({ source: clean, gate: { mode: 'full', passed: true } }),
    [],
  );
  for (const gate of [
    undefined,
    { mode: null, passed: false },
    { mode: 'build', passed: true },
    { mode: 'full', passed: false },
  ]) {
    assert.equal(
      gateProblems({ source: clean, gate }).length,
      1,
      JSON.stringify(gate),
    );
  }
});

test('accepts only a gate run on a clean working tree', () => {
  const gate = { mode: 'full', passed: true };
  for (const source of [
    undefined,
    { commit: 'abc' },
    { commit: 'abc', clean: false },
  ]) {
    const problems = gateProblems({ source, gate });
    assert.equal(problems.length, 1, JSON.stringify(source));
    assert.match(problems[0], /clean working tree/);
    assert.deepEqual(gateProblems({ source, gate }, { allowDirty: true }), []);
  }
  assert.equal(
    gateProblems(
      { source: { commit: 'abc', clean: false }, gate: { mode: 'build' } },
      { allowDirty: true },
    ).length,
    1,
  );
});

const NAMES = ['@pidrang/core', 'pidrang'];

function entry(name, version = '1.0.0') {
  return {
    name,
    version,
    file: `${name.replace('@', '').replace('/', '-')}-${version}.tgz`,
  };
}

test('accepts one tarball of each package at the gate version', () => {
  assert.deepEqual(
    packageProblems(
      {
        version: '1.0.0',
        tarballs: [entry('@pidrang/core'), entry('pidrang')],
      },
      NAMES,
    ),
    [],
  );
});

test('rejects a manifest without the tarballs of every package', () => {
  assert.deepEqual(packageProblems({ version: '1.0.0' }, NAMES), [
    'identities.json has no tarballs list',
  ]);
  assert.deepEqual(packageProblems({ version: '1.0.0', tarballs: [] }, NAMES), [
    '@pidrang/core: not among the tested tarballs',
    'pidrang: not among the tested tarballs',
  ]);
  assert.deepEqual(
    packageProblems({ version: '1.0.0', tarballs: [entry('pidrang')] }, NAMES),
    ['@pidrang/core: not among the tested tarballs'],
  );
});

test('rejects a repeated package, an unknown one and another version', () => {
  assert.deepEqual(
    packageProblems(
      {
        version: '1.0.0',
        tarballs: [
          entry('@pidrang/core'),
          entry('@pidrang/core', '1.0.1'),
          entry('pidrang'),
          entry('@pidrang/probe'),
        ],
      },
      NAMES,
    ),
    [
      '@pidrang/core: 2 tested tarballs',
      'pidrang-core-1.0.1.tgz: version is 1.0.1, the gate packed 1.0.0',
      'pidrang-probe-1.0.0.tgz: @pidrang/probe is not a pidrang package',
    ],
  );
});

test('accepts only the release version and commit when they are given', () => {
  const manifest = { version: '1.0.0', source: { commit: 'abc' } };
  const cases = [
    [{}, 0],
    [{ version: '1.0.0' }, 0],
    [{ commit: 'abc' }, 0],
    [{ version: '1.0.0', commit: 'abc' }, 0],
    [{ version: '1.0.1' }, 1],
    [{ commit: 'def' }, 1],
    [{ version: '1.0.1', commit: 'abc' }, 1],
    [{ version: '1.0.0', commit: 'def' }, 1],
    [{ version: '1.0.1', commit: 'def' }, 2],
    [{ version: '' }, 1],
    [{ commit: '' }, 1],
  ];
  for (const [expected, count] of cases) {
    assert.equal(
      expectationProblems(manifest, expected).length,
      count,
      JSON.stringify(expected),
    );
  }
});

test('rejects a manifest without the version or commit the release expects', () => {
  const expected = { version: '1.0.0', commit: 'abc' };
  assert.equal(expectationProblems({}, expected).length, 2);
  assert.equal(
    expectationProblems({ version: '1.0.0', source: {} }, expected).length,
    1,
  );
  assert.deepEqual(expectationProblems({}), []);
});
