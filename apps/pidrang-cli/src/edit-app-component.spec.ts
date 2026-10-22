import * as typescript from 'typescript';
import { editAppComponent } from './edit-app-component';

const PATH = 'src/app/app.ts';

const NG_APP = `import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('shop');
}
`;

const NG_APP_WITH_LAYOUT = `import { Component, signal } from '@angular/core';
import { AppLayout } from './layout/app-layout';

@Component({
  imports: [AppLayout],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('shop');
}
`;

function edited(source: string): string {
  const edit = editAppComponent(typescript, PATH, source);
  if (edit.kind !== 'edited') {
    throw new Error(`expected an edit, got ${edit.kind}`);
  }
  return edit.content;
}

describe('editAppComponent', () => {
  it('replaces RouterOutlet with the layout in an ng new root component', () => {
    expect(edited(NG_APP)).toBe(NG_APP_WITH_LAYOUT);
  });

  it('leaves a root component that already imports the layout alone', () => {
    expect(editAppComponent(typescript, PATH, NG_APP_WITH_LAYOUT)).toEqual({
      kind: 'unchanged',
    });
  });

  it('keeps the other router imports when it removes RouterOutlet', () => {
    const source = NG_APP.replace(
      "import { RouterOutlet } from '@angular/router';",
      "import { RouterLink, RouterOutlet } from '@angular/router';",
    ).replace('imports: [RouterOutlet]', 'imports: [RouterLink, RouterOutlet]');

    const content = edited(source);

    expect(content).toContain("import { RouterLink } from '@angular/router';");
    expect(content).toContain('imports: [RouterLink, AppLayout]');
  });

  it('removes a RouterOutlet import listed first among several', () => {
    const source = NG_APP.replace(
      "import { RouterOutlet } from '@angular/router';",
      "import { RouterOutlet, RouterLink } from '@angular/router';",
    ).replace('imports: [RouterOutlet]', 'imports: [RouterOutlet, RouterLink]');

    const content = edited(source);

    expect(content).toContain("import { RouterLink } from '@angular/router';");
    expect(content).toContain('imports: [AppLayout, RouterLink]');
  });

  it('removes a RouterOutlet import on the first line of the file', () => {
    const source = `import { RouterOutlet } from '@angular/router';
import { Component } from '@angular/core';

@Component({
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {}
`;

    expect(edited(source)).toBe(`import { Component } from '@angular/core';
import { AppLayout } from './layout/app-layout';

@Component({
  imports: [AppLayout],
  templateUrl: './app.html',
})
export class App {}
`);
  });

  it('keeps RouterOutlet when the class still uses it', () => {
    const source = NG_APP.replace(
      "protected readonly title = signal('shop');",
      'protected readonly outlet = viewChild(RouterOutlet);',
    );

    const content = edited(source);

    expect(content).toContain(
      "import { RouterOutlet } from '@angular/router';",
    );
    expect(content).toContain('imports: [RouterOutlet, AppLayout]');
  });

  it('adds the layout to an empty imports array', () => {
    const content = edited(
      NG_APP.replace('imports: [RouterOutlet]', 'imports: []').replace(
        "import { RouterOutlet } from '@angular/router';\n",
        '',
      ),
    );

    expect(content).toContain('imports: [AppLayout],');
    expect(content).toContain(
      "import { AppLayout } from './layout/app-layout';",
    );
  });

  it('adds an imports array to a root component without one', () => {
    const content = edited(
      NG_APP.replace('  imports: [RouterOutlet],\n', '').replace(
        "import { RouterOutlet } from '@angular/router';\n",
        '',
      ),
    );

    expect(content).toContain(
      "@Component({\n  imports: [AppLayout],\n  selector: 'app-root',",
    );
  });

  it.each([
    [
      'imports built elsewhere',
      NG_APP.replace('imports: [RouterOutlet]', 'imports: ROOT_IMPORTS'),
      'the imports of the root component are not a plain array',
    ],
    [
      'another AppLayout',
      NG_APP.replace(
        "import { RouterOutlet } from '@angular/router';",
        "import { RouterOutlet } from '@angular/router';\nimport { AppLayout } from './shell';",
      ),
      'the file already uses AppLayout for something else',
    ],
    [
      'no component',
      'export class App {}\n',
      'no single @Component with its metadata was found',
    ],
    [
      'two components',
      `${NG_APP}\n@Component({ template: '' })\nexport class Other {}\n`,
      'no single @Component with its metadata was found',
    ],
  ])('adds a pidrang comment for %s', (_, source, reason) => {
    const edit = editAppComponent(typescript, PATH, source);

    expect(edit).toMatchObject({ kind: 'manual', reason });
    expect(edit.kind === 'manual' && edit.content).toContain(
      "// pidrang:   import { AppLayout } from './layout/app-layout';",
    );
    expect(edit.kind === 'manual' && edit.content.endsWith(source)).toBe(true);
  });

  it('adds a pidrang comment once without TypeScript', () => {
    const edit = editAppComponent(null, PATH, NG_APP);

    expect(edit).toMatchObject({
      kind: 'manual',
      reason: 'TypeScript is not installed in this app',
    });
    const content = edit.kind === 'manual' ? edit.content : '';
    expect(content).toContain('// pidrang:   imports: [AppLayout],');
    expect(editAppComponent(null, PATH, content)).toEqual({
      kind: 'unchanged',
    });
  });
});
