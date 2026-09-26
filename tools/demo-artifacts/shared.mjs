import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const outputDirectory = resolve(root, 'dist/pages');

export const origin = 'https://pidrang.dev';

export const demos = [
  { project: 'demo-material', path: 'demo-material' },
  { project: 'demo-tailwind', path: 'demo-tailwind' },
];

export const libraries = ['core', 'supabase', 'material', 'tailwind'];
