import { GeneratedFile } from './generated-file';
import {
  MATERIAL_LAYOUT_MODULE,
  TAILWIND_LAYOUT_MODULE,
} from './generated-layout';

export const LAYOUT_FILE = 'src/app/layout/app-layout.ts';

const LAYOUT_MODULE_IMPORT = './layout/app-layout';

export function layoutImport(): string {
  return `import { AppLayout } from '${LAYOUT_MODULE_IMPORT}';\n`;
}

export function layoutAppHtml(appName: string): string {
  return `<app-layout appName=${JSON.stringify(appName)} />\n`;
}

const LAYOUTS = {
  material: MATERIAL_LAYOUT_MODULE,
  tailwind: TAILWIND_LAYOUT_MODULE,
};

export function generateLayoutFile(ui: 'material' | 'tailwind'): GeneratedFile {
  return { path: LAYOUT_FILE, content: LAYOUTS[ui] };
}
