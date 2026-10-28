import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const sourceDirectory = resolve(root, 'docs');

export const sourceCopyDirectory = resolve(root, 'dist/docs-src');

export const outputDirectory = resolve(root, 'dist/pages/docs');

export const origin = 'https://pidrang.dev';

export const repository = 'pidrang/pidrang';

export const branch = 'main';

export const base = '/docs/';

export const docsPath = '/docs/';

const GITHUB_BLOB = `https://github.com/${repository}/blob/${branch}`;

const GITHUB_TREE = `https://github.com/${repository}/tree/${branch}`;

const UNTOUCHED = /^(?:https?:\/\/|mailto:|#)/;

const LOCAL_MARKDOWN = /^\.\/([A-Za-z0-9_./-]+\.md)(#[^\s]*)?$/;

export class LinkError extends Error {}

function githubTarget(path, suffix) {
  if (!path || path.startsWith('/') || path.split('/').includes('..')) {
    throw new LinkError(`cannot rewrite ${path}`);
  }
  return path.endsWith('.md')
    ? `${GITHUB_BLOB}/${path}${suffix}`
    : `${GITHUB_TREE}/${path}${suffix}`;
}

export function rewriteLink(link, file = '') {
  const target = link.trim();
  if (UNTOUCHED.test(target)) {
    return target;
  }
  const local = target.match(LOCAL_MARKDOWN);
  if (local) {
    return `${local[1]}${local[2] ?? ''}`;
  }
  if (!target.startsWith('../')) {
    throw new LinkError(`cannot rewrite ${link}`);
  }
  const [rawPath, ...hash] = target.split('#');
  const suffix = hash.length > 0 ? `#${hash.join('#')}` : '';
  const directory = dirname(file);
  const resolved = normalize(join(directory, rawPath)).split(sep).join('/');
  if (resolved.startsWith('../')) {
    return githubTarget(resolved.slice('../'.length), suffix);
  }
  const page = resolved.endsWith('.md')
    ? resolved.slice(0, -'.md'.length)
    : resolved;
  return `${page}${suffix}`;
}

export function rewriteLinks(markdown, file) {
  return markdown
    .split('\n')
    .map((line, index) => {
      if (!line.includes('](')) {
        return line;
      }
      const rewritten = line.replace(
        /\]\(([^()\s]+(?:\s+["'][^"']*["'])?)\)/g,
        (match, content) => {
          const label = content.match(/\s+["'][^"']*["']$/);
          const link = label
            ? content.slice(0, content.length - label[0].length)
            : content;
          try {
            return `](${rewriteLink(link, file)}${label ? label[0] : ''})`;
          } catch (error) {
            throw new LinkError(
              `${file}:${index + 1}: ${error.message} in ${match}`,
            );
          }
        },
      );
      return rewritten;
    })
    .join('\n');
}
