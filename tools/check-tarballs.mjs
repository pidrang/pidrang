import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { packages, tarballDirectory } from './shared.mjs';

const LOCAL_PROTOCOL = /^(workspace|file|link|portal):/;
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
  'devDependencies',
];
const FORBIDDEN_FILES = [
  /(^|\/)\.env/,
  /\.(spec|test)\./,
  /(^|\/)node_modules\//,
  /(^|\/)\.(nx|angular|cache)\//,
  /\.tsbuildinfo$/,
  /\.(pem|key)$/,
];
const SECRET_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /sb_secret_[A-Za-z0-9_-]+/,
  /npm_[A-Za-z0-9]{36}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /postgres(ql)?:\/\/[^\s:@/]+:[^\s@/]+@/,
];
const TEXT_FILE = /\.(js|mjs|cjs|json|md|ts|html|css)$/;

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function entrypointPaths(manifest) {
  const paths = [
    manifest.main,
    manifest.module,
    manifest.types,
    manifest.typings,
  ];
  if (typeof manifest.bin === 'string') {
    paths.push(manifest.bin);
  } else if (manifest.bin) {
    paths.push(...Object.values(manifest.bin));
  }
  const collect = (value) => {
    if (typeof value === 'string') {
      paths.push(value);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(collect);
    }
  };
  collect(manifest.exports);
  return paths.filter(
    (path) => typeof path === 'string' && path.startsWith('.'),
  );
}

function binPaths(manifest) {
  if (typeof manifest.bin === 'string') {
    return [manifest.bin];
  }
  return Object.values(manifest.bin ?? {});
}

function checkPackage(name, directory, problems) {
  const report = (message) => problems.push(`${name}: ${message}`);
  const manifest = JSON.parse(
    readFileSync(join(directory, 'package.json'), 'utf8'),
  );

  if (manifest.private) {
    report('package.json is private');
  }
  for (const field of [
    'description',
    'license',
    'repository',
    'homepage',
    'bugs',
  ]) {
    if (!manifest[field]) {
      report(`package.json has no "${field}"`);
    }
  }
  if (manifest.publishConfig?.access !== 'public') {
    report('package.json has no publishConfig.access "public"');
  }

  for (const section of DEPENDENCY_SECTIONS) {
    for (const [dependency, range] of Object.entries(manifest[section] ?? {})) {
      if (LOCAL_PROTOCOL.test(range)) {
        report(`${section}.${dependency} is "${range}"`);
      }
    }
  }

  for (const required of ['README.md', 'LICENSE']) {
    if (!existsSync(join(directory, required))) {
      report(`missing ${required}`);
    }
  }

  for (const path of entrypointPaths(manifest)) {
    if (!existsSync(join(directory, path))) {
      report(`entrypoint ${path} does not exist`);
    }
  }

  for (const path of binPaths(manifest)) {
    const file = join(directory, path);
    if (existsSync(file) && !readFileSync(file, 'utf8').startsWith('#!')) {
      report(`bin ${path} has no shebang`);
    }
  }

  for (const file of listFiles(directory)) {
    const path = relative(directory, file);
    if (FORBIDDEN_FILES.some((pattern) => pattern.test(path))) {
      report(`unwanted file ${path}`);
    }
    if (
      path.endsWith('.map') &&
      !JSON.parse(readFileSync(file, 'utf8')).sourcesContent
    ) {
      report(`source map ${path} does not embed its sources`);
    }
    if (TEXT_FILE.test(path) && statSync(file).size < 5_000_000) {
      const content = readFileSync(file, 'utf8');
      const secret = SECRET_PATTERNS.find((pattern) => pattern.test(content));
      if (secret) {
        report(`${path} matches a credential pattern ${secret}`);
      }
    }
  }

  return manifest;
}

const work = mkdtempSync(join(tmpdir(), 'pidrang-tarballs-'));
const problems = [];
const seen = new Map();

try {
  const tarballs = existsSync(tarballDirectory)
    ? readdirSync(tarballDirectory).filter((file) => file.endsWith('.tgz'))
    : [];
  if (tarballs.length === 0) {
    problems.push(`no tarball found in ${tarballDirectory}`);
  }

  tarballs.forEach((tarball, index) => {
    const target = join(work, String(index));
    execFileSync('mkdir', ['-p', target]);
    execFileSync('tar', [
      '-xzf',
      join(tarballDirectory, tarball),
      '-C',
      target,
    ]);
    const directory = join(target, 'package');
    const name = JSON.parse(
      readFileSync(join(directory, 'package.json'), 'utf8'),
    ).name;
    seen.set(name, { tarball, directory });
  });

  for (const pkg of packages) {
    const found = seen.get(pkg.name);
    if (!found) {
      problems.push(`${pkg.name}: no tarball`);
      continue;
    }
    checkPackage(pkg.name, found.directory, problems);
  }

  const versions = new Set(
    [...seen.values()].map(
      ({ directory }) =>
        JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
          .version,
    ),
  );
  if (versions.size > 1) {
    problems.push(
      `packages do not share one version: ${[...versions].join(', ')}`,
    );
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error(`Tarball check failed with ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(`Tarball check passed for ${seen.size} package(s).`);
