import { FileEdit } from './edit-app-config';
import { stripLeadingLines } from './text-edit';

const OUTLET = '<router-outlet />';
const COMMENT = '<!-- pidrang:';

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

export function isWelcome(
  source: string,
  welcomeTemplate: string | null,
): boolean {
  const current = normalize(source);
  if (welcomeTemplate !== null) {
    return current === normalize(welcomeTemplate);
  }
  return (
    current.includes('Congratulations! Your app is running') &&
    current.endsWith(OUTLET)
  );
}

function withoutComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, '');
}

export function editAppHtml(
  path: string,
  source: string,
  welcomeTemplate: string | null,
): FileEdit {
  if (isWelcome(source, welcomeTemplate)) {
    return { kind: 'edited', content: `${OUTLET}\n` };
  }
  const rest = stripLeadingLines(source, COMMENT);
  if (/<router-outlet\b/.test(withoutComments(rest))) {
    return { kind: 'unchanged' };
  }
  const steps = [
    'pidrang could not edit this file safely. Add the router outlet by hand, then delete these pidrang lines.',
    'The generated pages only show up through a router outlet of the app component:',
    `  ${OUTLET}`,
    'A page that stays empty may come from the Angular welcome content hiding it.',
    'If a component of this template already holds the router outlet, only delete these pidrang lines.',
  ];
  const content = `${steps.map((step) => `${COMMENT} ${step} -->`).join('\n')}\n${rest}`;
  return content === source
    ? { kind: 'unchanged' }
    : {
        kind: 'manual',
        content,
        reason: 'app.html was customized and has no router outlet',
      };
}
