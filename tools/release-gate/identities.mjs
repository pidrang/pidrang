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

export function gateProblems(manifest, { allowDirty = false } = {}) {
  const problems = [];
  if (manifest.gate?.mode !== 'full' || manifest.gate?.passed !== true) {
    problems.push(
      `${MANIFEST} does not record a passed full release gate (gate: ${JSON.stringify(manifest.gate ?? null)})`,
    );
  }
  if (!allowDirty && manifest.source?.clean !== true) {
    problems.push(
      `${MANIFEST} does not record a clean working tree: the tarballs may hold uncommitted changes (source: ${JSON.stringify(manifest.source ?? null)})`,
    );
  }
  return problems;
}

export function expectationProblems(manifest, { version, commit } = {}) {
  const problems = [];
  if (version !== undefined && manifest.version !== version) {
    problems.push(
      `${MANIFEST} records version ${manifest.version}, the release is ${version}`,
    );
  }
  if (commit !== undefined && manifest.source?.commit !== commit) {
    problems.push(
      `${MANIFEST} records commit ${manifest.source?.commit}, the release is ${commit}`,
    );
  }
  return problems;
}

export function packageProblems(manifest, names) {
  if (!Array.isArray(manifest.tarballs)) {
    return [`${MANIFEST} has no tarballs list`];
  }
  const problems = [];
  for (const name of names) {
    const count = manifest.tarballs.filter(
      (entry) => entry.name === name,
    ).length;
    if (count === 0) {
      problems.push(`${name}: not among the tested tarballs`);
    } else if (count > 1) {
      problems.push(`${name}: ${count} tested tarballs`);
    }
  }
  for (const entry of manifest.tarballs) {
    if (!names.includes(entry.name)) {
      problems.push(`${entry.file}: ${entry.name} is not a pidrang package`);
    }
    if (entry.version !== manifest.version) {
      problems.push(
        `${entry.file}: version is ${entry.version}, the gate packed ${manifest.version}`,
      );
    }
  }
  return problems;
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
