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
title: Documentation
description: "Pidrang documentation: getting started, architecture, data providers, UI layers, reference and maintainer notes."

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

## What it is

Pidrang is a headless admin framework for Angular: a \`Resource\` describes a table and its fields, a data provider reads and writes it, and a UI layer renders the list, the forms and the actions. Nothing is generated per table, so a new table is a few lines.

Pre-1.0: the public API may change between minor versions.

## Install

\`\`\`bash
npm install @pidrang/core @pidrang/supabase @pidrang/material @supabase/supabase-js
ng add @angular/material
npx pidrang init
\`\`\`

## See it running

- [demo-material](https://pidrang.dev/demo-material/): the same three resources on Angular Material.
- [demo-tailwind](https://pidrang.dev/demo-tailwind/): the same three resources on Tailwind CSS.
- [pidrang.dev/demos](https://pidrang.dev/demos/): both demos.

## The guide

- [Getting started](getting-started): generate the admin with \`pidrang init\`, on a new or an existing Angular app.
- [Write the pages yourself](manual-setup): the same list, create, edit and sign-in pages, built by hand.
- [Authentication](authentication): signing users in, and what the Row Level Security policies decide.
- [UI layers](ui-layers/): the same components on Angular Material and Tailwind, and which one to pick.
- [Architecture](architecture): how the core, the data providers and the UI layers fit together.
- [Data providers](data-providers): connect Pidrang to your own backend.

## Reference

- [Core](reference/core): the contracts, the providers and the injected helpers.
- [Components](reference/components): ResourceTable and ResourceForm, with both UI layers.
- [CLI](reference/cli): commands, options, the plan file, exit codes and the files init writes.

## For maintainers

- [Design notes](design-notes): the reason behind every non-obvious choice.
- [Releasing](releasing): the release process.
- [Demo artifacts](demo-artifacts): how the demos are built and deployed.

`;

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

// First prose paragraph of a page, as plain text, for the meta description
function firstProse(markdown) {
  const body = markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '');
  for (const block of body.split(/\r?\n\s*\r?\n/)) {
    const raw = block.trim();
    if (!raw || /^(#|>|\||`{3}|:::|<|[-*+] |\d+\. )/.test(raw)) {
      continue;
    }
    const text = raw
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length >= 60 && !text.endsWith(':')) {
      return text;
    }
  }
  return null;
}

function clamp(text, limit) {
  if (text.length <= limit) {
    return text;
  }
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > 0 ? space : limit)}...`;
}

// VitePress reuses the site description otherwise; the sources keep no front matter
function withDescription(markdown) {
  if (/^---\r?\n[\s\S]*?\bdescription:/m.test(markdown)) {
    return markdown;
  }
  const prose = firstProse(markdown);
  if (!prose) {
    return markdown;
  }
  const line = `description: ${JSON.stringify(clamp(prose, 155))}`;
  return /^---\r?\n/.test(markdown)
    ? markdown.replace(/^---\r?\n/, `---\n${line}\n`)
    : `---\n${line}\n---\n\n${markdown}`;
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

function assertGithubLinksExist() {
  const missing = [];
  const githubLink =
    /https:\/\/github\.com\/pidrang\/pidrang\/blob\/main\/([A-Za-z0-9_./-]+\.md)/g;
  for (const file of listFiles(sourceCopyDirectory).filter((name) =>
    name.endsWith('.md'),
  )) {
    const content = readFileSync(join(sourceCopyDirectory, file), 'utf8');
    for (const [, path] of content.matchAll(githubLink)) {
      if (!existsSync(resolve(root, path))) {
        missing.push(`${file} links to missing ${path}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`Dead GitHub links:\n${missing.join('\n')}`);
  }
}

function assertLocalLinksResolve() {
  const missing = [];
  const attribute = /(?:href|src)="([^"]+)"/g;
  for (const file of listFiles(outputDirectory).filter((name) =>
    name.endsWith('.html'),
  )) {
    const content = readFileSync(join(outputDirectory, file), 'utf8');
    for (const [, link] of content.matchAll(attribute)) {
      if (
        !link.startsWith('/docs/') &&
        !link.startsWith('./') &&
        !link.startsWith('../')
      ) {
        continue;
      }
      const path = link.split('#')[0].split('?')[0];
      if (!path) {
        continue;
      }
      const resolved = path.startsWith('/docs/')
        ? resolve(outputDirectory, path.slice('/docs/'.length))
        : resolve(join(outputDirectory, dirname(file)), path);
      if (
        existsSync(resolved) ||
        existsSync(`${resolved}.html`) ||
        existsSync(join(resolved, 'index.html'))
      ) {
        continue;
      }
      missing.push(`${file}: ${link}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Dead local links:\n${missing.join('\n')}`);
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
  writeFileSync(
    path,
    withDescription(rewriteLinks(readFileSync(path, 'utf8'), file)),
  );
}

assertSourceLinks();
assertGithubLinksExist();

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

const customStylesheet = join(outputDirectory, 'custom.css');
cpSync(join(VITEPRESS_DIRECTORY, 'custom.css'), customStylesheet);
if (!existsSync(customStylesheet)) {
  throw new Error('custom.css is missing from the build');
}

assertBuiltPage();
assertLocalLinksResolve();
assertNoPrivilegedContent(outputDirectory);

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
