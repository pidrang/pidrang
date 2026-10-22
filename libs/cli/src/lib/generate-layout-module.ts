import { GeneratedFile } from './generated-file';
import {
  MATERIAL_LAYOUT_MODULE,
  TAILWIND_LAYOUT_MODULE,
} from './generated-layout';
import { LayoutUi } from './layout-ui';

export const LAYOUT_FILE = 'src/app/layout/app-layout.ts';

export function layoutAppHtml(appName: string): string {
  return `<app-layout appName=${JSON.stringify(appName)} />\n`;
}

const LAYOUTS = {
  material: MATERIAL_LAYOUT_MODULE,
  tailwind: TAILWIND_LAYOUT_MODULE,
};

export function generateLayoutFile(ui: LayoutUi): GeneratedFile {
  return { path: LAYOUT_FILE, content: LAYOUTS[ui] };
}
