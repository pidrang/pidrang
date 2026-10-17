import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  distTag,
  integrity,
  publishAction,
  publishOrder,
} from './publishing.mjs';

let work;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'pidrang-publishing-'));
});

afterEach(() => rmSync(work, { recursive: true, force: true }));

test('tags a release latest and a prerelease next', () => {
  for (const [version, tag] of [
    ['0.1.0', 'latest'],
    ['1.0.0', 'latest'],
    ['0.1.0-rc.1', 'next'],
    ['0.0.0-gate.abc123', 'next'],
  ]) {
    assert.equal(distTag(version), tag, version);
  }
});

test('publishes in the order of the package list, not of the manifest', () => {
  const tarballs = [
    { name: 'pidrang', file: 'pidrang.tgz' },
    { name: '@pidrang/core', file: 'core.tgz' },
  ];
  assert.deepEqual(
    publishOrder(tarballs, ['@pidrang/core', 'pidrang']).map(
      (entry) => entry.file,
    ),
    ['core.tgz', 'pidrang.tgz'],
  );
});

test('refuses to publish when a package has no tested tarball', () => {
  assert.throws(
    () => publishOrder([{ name: 'pidrang' }], ['@pidrang/core', 'pidrang']),
    /@pidrang\/core: no tested tarball/,
  );
});

test('computes the integrity npm records for a tarball', () => {
  writeFileSync(
    join(work, 'package.json'),
    JSON.stringify({ name: '@pidrang/probe', version: '1.0.0' }),
  );
  const output = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', work], {
      cwd: work,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  );
  const [packed] = Array.isArray(output) ? output : Object.values(output);
  assert.equal(integrity(join(work, packed.filename)), packed.integrity);
});

test('publishes a new version, skips the same content, refuses other content', () => {
  assert.equal(publishAction(null, 'sha512-a'), 'publish');
  assert.equal(publishAction('sha512-a', 'sha512-a'), 'skip');
  assert.equal(publishAction('sha512-b', 'sha512-a'), 'conflict');
});
