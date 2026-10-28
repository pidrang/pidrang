import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import {
  docsPath,
  origin,
  outputDirectory,
  repository,
  rewriteLinks,
  root,
  sourceCopyDirectory,
  sourceDirectory,
} from './shared.mjs';

const TEXT_FILE = /\.(md|js|mjs|ts|html|css|json|txt|svg)$/;
const EXCLUDED = new Set(['.vitepress/dist', '.vitepress/cache', 'node_modules']);
const VITEPRESS_DIRECTORY = join(sourceDirectory, '.vitepress');
const FORBIDDEN_CONTENT = [
  /sb_secret_[A-Za-z0-9_-]{16,}/,
  /postgres(ql)?:\/\/[^\s:@/]+:[^\s@/]+@/,
];
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;

const landingPage = `---
layout: home

hero:
  name: Pidrang
  text: Generate an Angular admin from your Supabase schema.
  tagline: Build Angular admin applications faster. One resource contract, any data provider, any UI layer.
  actions:
    - theme: brand
      text: Get started
      link: getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/${repository}
---

## The guide

- [Getting started](getting-started): from a new Angular app to a working list, create and edit flow.
- [Architecture](architecture): how the core, the data providers and the UI layers fit together.
- [Data providers](data-providers): connect Pidrang to your own backend.

## Reference

- [Core](reference/core): the contracts, the providers and the injected helpers.
- [Components](reference/components): ResourceTable and ResourceForm, with both UI layers.
- [UI layers](ui-layers/): the same components on Angular Material and Tailwind, and which one to pick.
- [CLI](reference/cli): commands, options, the plan file, exit codes and the files init writes.

## For maintainers

- [Design notes](design-notes): the reason behind every non-obvious choice.
- [Releasing](releasing): the release process.
- [Demo artifacts](demo-artifacts): how the demos are built and deployed.

## Edit a page

Every page links to its markdown source on GitHub. The site is rebuilt by the Docs artifacts workflow, then deployed by a pull request in pidrang.github.io.
`;

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function listFiles(directory, relative = '') {
  return readdirSync(join(directory, relative), { withFileTypes: true })
    .filter((entry) => !EXCLUDED.has(relative ? `${relative}/${entry.name}` : entry.name))
    .flatMap((entry) => {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listFiles(directory, path) : [path];
    });
}

function sourcePages() {
  return [
    'index',
    ...listFiles(sourceDirectory)
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.slice(0, -'.md'.length))
      .filter((page) => page !== 'index')
      .sort(),
  ];
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
    if (!TEXT_FILE.test(file) || file.endsWith('.excalidraw')) {
      continue;
    }
    const content = readFileSync(join(directory, file), 'utf8');
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

function assertLinksStayLocal(directory) {
  const problems = [];
  for (const file of listFiles(directory).filter((name) => name.endsWith('.md'))) {
    const content = readFileSync(join(directory, file), 'utf8');
    content.split('\n').forEach((line, index) => {
      if (/\]\(\.\.\//.test(line)) {
        problems.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  if (problems.length > 0) {
    throw new Error(
      `Links leaving docs/ were not rewritten:\n${problems.join('\n')}`,
    );
  }
}

function assertSourceLinks() {
  const missing = [];
  const localLink = /\]\(([^)\s#:]+\.md)(?:#[^)\s]*)?\)/g;
  for (const file of listFiles(sourceCopyDirectory).filter((name) =>
    name.endsWith('.md'),
  )) {
    const fileDir = dirname(file);
    const content = readFileSync(join(sourceCopyDirectory, file), 'utf8');
    for (const [, link] of content.matchAll(localLink)) {
      const resolved = resolve(sourceCopyDirectory, fileDir, link);
      if (!existsSync(resolved)) {
        missing.push(`${file} links to missing ${link}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`Dead links in docs/:\n${missing.join('\n')}`);
  }
}

function assertBuiltPage() {
  const index = join(outputDirectory, 'index.html');
  if (!existsSync(index)) {
    throw new Error(`${index} is missing`);
  }
  const html = readFileSync(index, 'utf8');
  if (!html.includes('href="/docs/assets/') && !html.includes('src="/docs/assets/')) {
    throw new Error('index.html does not reference /docs/assets/');
  }
  for (const page of sourcePages()) {
    if (!existsSync(join(outputDirectory, `${page}.html`))) {
      throw new Error(`${page}.html is missing`);
    }
  }
  if (!html.includes('href="/docs/custom.css"')) {
    throw new Error('index.html does not link /docs/custom.css');
  }
}

rmSync(sourceCopyDirectory, { recursive: true, force: true });
rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(sourceCopyDirectory, { recursive: true });

cpSync(sourceDirectory, sourceCopyDirectory, {
  recursive: true,
  filter: (source) => {
    const relative = source.slice(sourceDirectory.length).replace(/^[/\\]/, '');
    return !EXCLUDED.has(relative);
  },
});

for (const file of listFiles(sourceCopyDirectory).filter((name) =>
  name.endsWith('.md'),
)) {
  const path = join(sourceCopyDirectory, file);
  writeFileSync(path, rewriteLinks(readFileSync(path, 'utf8'), file));
}

assertLinksStayLocal(sourceCopyDirectory);
assertSourceLinks();

writeFileSync(join(sourceCopyDirectory, 'index.md'), landingPage);

execFileSync(
  process.execPath,
  [
    '--import',
    'tsx',
    'node_modules/vitepress/bin/vitepress.js',
    'build',
    sourceCopyDirectory,
    '--outDir',
    outputDirectory,
  ],
  { cwd: root, stdio: 'inherit' },
);

assertBuiltPage();
assertNoPrivilegedContent(outputDirectory);

const customStylesheet = join(outputDirectory, 'custom.css');
cpSync(join(VITEPRESS_DIRECTORY, 'custom.css'), customStylesheet);
if (!existsSync(customStylesheet)) {
  throw new Error('custom.css is missing from the build');
}

const metadata = {
  schema: 1,
  source: {
    repository: process.env.GITHUB_REPOSITORY ?? repository,
    commit: git('rev-parse', 'HEAD'),
    ref: process.env.GITHUB_REF_NAME ?? git('rev-parse', '--abbrev-ref', 'HEAD'),
    dirty: git('status', '--porcelain').length > 0,
    workflow: process.env.GITHUB_WORKFLOW ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
  },
  builtAt: new Date().toISOString(),
  origin,
  docs: {
    path: docsPath,
    url: `${origin}${docsPath}`,
    pages: sourcePages(),
  },
};

writeFileSync(
  join(outputDirectory, 'metadata.json'),
  `${JSON.stringify(metadata, null, 2)}\n`,
);

console.log(`Docs artifacts written to ${outputDirectory}`);
