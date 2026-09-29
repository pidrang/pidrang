import { GeneratedFile } from './generated-file';
import { PAGES_BUNDLE_SOURCES } from './pages-bundle-sources';

export function buildPagesBundle(
  readSource: (path: string) => string,
): GeneratedFile[] {
  return PAGES_BUNDLE_SOURCES.map(({ target, source }) => ({
    path: target,
    content: readSource(source),
  }));
}
