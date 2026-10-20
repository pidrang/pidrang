import { editAppHtml } from './edit-app-html';

const WELCOME = `<div class="welcome">
  <h1>Hello</h1>
  <p>Congratulations! Your app is running.</p>
</div>
<router-outlet />`;

describe('editAppHtml', () => {
  it('replaces the welcome template of ng new with the router outlet', () => {
    expect(editAppHtml('src/app/app.html', `${WELCOME}\n`, WELCOME)).toEqual({
      kind: 'edited',
      content: '<router-outlet />\n',
    });
  });

  it('recognizes the welcome template when the CLI templates are not installed', () => {
    expect(editAppHtml('src/app/app.html', WELCOME, null)).toEqual({
      kind: 'edited',
      content: '<router-outlet />\n',
    });
  });

  it('leaves a customized template that has an outlet alone', () => {
    const source = '<main><router-outlet /></main>\n';

    expect(editAppHtml('src/app/app.html', source, WELCOME)).toEqual({
      kind: 'unchanged',
    });
  });

  it('adds a comment to a customized template with no outlet', () => {
    const source = '<main>Custom</main>\n';
    const result = editAppHtml('src/app/app.html', source, WELCOME);

    expect(result.kind).toBe('manual');
    if (result.kind === 'manual') {
      expect(result.reason).toBe(
        'app.html was customized and has no router outlet',
      );
      expect(result.content.startsWith('<!-- pidrang:')).toBe(true);
      expect(result.content).toContain('<router-outlet />');
      expect(result.content.endsWith(source)).toBe(true);
    }
  });

  it('does not accumulate its own comment', () => {
    const first = editAppHtml(
      'src/app/app.html',
      '<main>Custom</main>\n',
      WELCOME,
    );
    if (first.kind !== 'manual') {
      throw new Error('expected a comment');
    }

    expect(editAppHtml('src/app/app.html', first.content, WELCOME)).toEqual({
      kind: 'unchanged',
    });
  });

  it('ignores the line endings of the welcome template', () => {
    expect(
      editAppHtml('src/app/app.html', WELCOME.replace(/\n/g, '\r\n'), WELCOME),
    ).toEqual({ kind: 'edited', content: '<router-outlet />\n' });
  });
});
