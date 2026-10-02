import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const MANIFEST = 'identities.json';

export function tarballManifest(file) {
  return JSON.parse(
    execFileSync('tar', ['-xzOf', file, 'package/package.json'], {
      encoding: 'utf8',
    }),
  );
}

export function describeTarball(directory, file) {
  const path = join(directory, file);
  const manifest = tarballManifest(path);
  return {
    name: manifest.name,
    version: manifest.version,
    file,
    size: statSync(path).size,
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  };
}

export function describeTarballs(directory) {
  return readdirSync(directory)
    .filter((file) => file.endsWith('.tgz'))
    .sort()
    .map((file) => describeTarball(directory, file));
}

export function gateProblems(manifest) {
  if (manifest.gate?.mode === 'full' && manifest.gate?.passed === true) {
    return [];
  }
  return [
    `${MANIFEST} does not record a passed full release gate (gate: ${JSON.stringify(manifest.gate ?? null)})`,
  ];
}

export function compareTarballs(expected, actual) {
  const problems = [];
  const byFile = new Map(actual.map((entry) => [entry.file, entry]));
  for (const entry of expected) {
    const found = byFile.get(entry.file);
    if (!found) {
      problems.push(`${entry.file}: missing`);
      continue;
    }
    for (const key of ['name', 'version', 'size', 'sha256']) {
      if (found[key] !== entry[key]) {
        problems.push(
          `${entry.file}: ${key} is ${found[key]}, the gate tested ${entry[key]}`,
        );
      }
    }
    byFile.delete(entry.file);
  }
  for (const file of byFile.keys()) {
    problems.push(`${file}: not tested by the gate`);
  }
  return problems;
}
