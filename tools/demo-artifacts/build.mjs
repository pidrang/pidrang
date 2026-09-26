import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

import { demos, libraries, origin, outputDirectory, root } from './shared.mjs';

const TEXT_FILE = /\.(js|mjs|html|css|json|txt|svg)$/;
const FORBIDDEN_CONTENT = [
  /service_role/,
  /sb_secret_[A-Za-z0-9_-]{16,}/,
  /postgres(ql)?:\/\/[^\s:@/]+:[^\s@/]+@/,
];
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function privilegedTokens(content) {
  return [...content.matchAll(JWT)].filter((match) => {
    try {
      const payload = JSON.parse(
        Buffer.from(match[1], 'base64url').toString('utf8'),
      );
      return payload.role !== undefined && payload.role !== 'anon';
    } catch {
      return false;
    }
  });
}

function assertNoPrivilegedContent(directory) {
  const problems = [];
  for (const file of listFiles(directory)) {
    if (!TEXT_FILE.test(file)) {
      continue;
    }
    const content = readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN_CONTENT) {
      if (pattern.test(content)) {
        problems.push(`${file} matches ${pattern}`);
      }
    }
    if (privilegedTokens(content).length > 0) {
      problems.push(`${file} contains a JWT with a role other than anon`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `Refusing to publish sensitive content:\n${problems.join('\n')}`,
    );
  }
}

function libraryVersions() {
  return Object.fromEntries(
    libraries.map((library) => {
      const manifest = JSON.parse(
        readFileSync(resolve(root, `libs/${library}/package.json`), 'utf8'),
      );
      return [manifest.name, manifest.version];
    }),
  );
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

execFileSync(
  'pnpm',
  [
    'exec',
    'nx',
    'run-many',
    '-t',
    'build',
    '-p',
    demos.map((demo) => demo.project).join(','),
    '-c',
    'pages',
  ],
  { cwd: root, stdio: 'inherit' },
);

for (const demo of demos) {
  cpSync(
    resolve(root, `dist/apps/${demo.project}/browser`),
    join(outputDirectory, demo.path),
    { recursive: true },
  );
}

cpSync(
  resolve(root, 'tools/demo-artifacts/pages-404.html'),
  join(outputDirectory, '404.html'),
);

assertNoPrivilegedContent(outputDirectory);

const metadata = {
  schema: 1,
  source: {
    repository: process.env.GITHUB_REPOSITORY ?? 'pidrang/pidrang',
    commit: git('rev-parse', 'HEAD'),
    ref:
      process.env.GITHUB_REF_NAME ?? git('rev-parse', '--abbrev-ref', 'HEAD'),
    dirty: git('status', '--porcelain').length > 0,
    workflow: process.env.GITHUB_WORKFLOW ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
  },
  builtAt: new Date().toISOString(),
  origin,
  demos: demos.map((demo) => ({
    name: demo.project,
    path: `/${demo.path}/`,
    url: `${origin}/${demo.path}/`,
  })),
  packages: libraryVersions(),
};

writeFileSync(
  join(outputDirectory, 'metadata.json'),
  `${JSON.stringify(metadata, null, 2)}\n`,
);

console.log(`Demo artifacts written to ${outputDirectory}`);
