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
  gateProblems,
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

test('accepts only a manifest whose full gate passed', () => {
  assert.deepEqual(gateProblems({ gate: { mode: 'full', passed: true } }), []);
  for (const gate of [
    undefined,
    { mode: null, passed: false },
    { mode: 'build', passed: true },
    { mode: 'full', passed: false },
  ]) {
    assert.equal(gateProblems({ gate }).length, 1, JSON.stringify(gate));
  }
});
