import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { spaFile } from './spa-file.mjs';

let work;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'pidrang-spa-'));
  mkdirSync(join(work, 'site'));
  mkdirSync(join(work, 'site-secrets'));
  writeFileSync(join(work, 'site', 'index.html'), 'index');
  writeFileSync(join(work, 'site', 'main.js'), 'main');
  writeFileSync(join(work, 'site-secrets', 'key.json'), 'secret');
});

afterEach(() => rmSync(work, { recursive: true, force: true }));

test('serves files of the site and falls back to index.html', () => {
  const site = join(work, 'site');
  assert.deepEqual(spaFile(site, '/main.js'), {
    status: 200,
    file: join(site, 'main.js'),
  });
  assert.deepEqual(spaFile(site, '/products/1/edit'), {
    status: 200,
    file: join(site, 'index.html'),
  });
});

test('refuses a path that leaves the site, even into a sibling with the same prefix', () => {
  const site = join(work, 'site');
  assert.equal(spaFile(site, '/..%2fsite-secrets/key.json').status, 403);
  assert.equal(spaFile(site, '/../site-secrets/key.json').status, 403);
});

test('answers 400 to a malformed encoding instead of throwing', () => {
  assert.deepEqual(spaFile(join(work, 'site'), '/%ZZ'), { status: 400 });
});
