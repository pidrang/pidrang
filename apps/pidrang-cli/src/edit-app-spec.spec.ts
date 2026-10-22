import * as typescript from 'typescript';
import { editAppSpec } from './edit-app-spec';

const CREATE_TEST = `  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });`;

function spec(...tests: string[]): string {
  return `import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

${tests.join('\n\n')}
});
`;
}

const ZONE_TITLE_TEST = `  it('should render title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, admin');
  });`;

const ZONELESS_TITLE_TEST = `  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector("h1")?.textContent).toContain('Hello, admin');
  });`;

const OWN_HEADING_TEST = `  it('shows the brand', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.nativeElement.querySelector('h1')).not.toBeNull();
  });`;

const PATH = 'src/app/app.spec.ts';

describe('editAppSpec', () => {
  it.each([
    ['zone', ZONE_TITLE_TEST],
    ['zoneless', ZONELESS_TITLE_TEST],
  ])(
    'removes the title test of a %s ng new spec and keeps the others',
    (_, titleTest) => {
      expect(
        editAppSpec(typescript, PATH, spec(CREATE_TEST, titleTest)),
      ).toEqual({ kind: 'edited', content: spec(CREATE_TEST) });
    },
  );

  it('keeps Windows line endings', () => {
    const source = spec(CREATE_TEST, ZONE_TITLE_TEST).replace(/\n/g, '\r\n');

    expect(editAppSpec(typescript, PATH, source)).toEqual({
      kind: 'edited',
      content: spec(CREATE_TEST).replace(/\n/g, '\r\n'),
    });
  });

  it('leaves a spec it already edited alone', () => {
    expect(editAppSpec(typescript, PATH, spec(CREATE_TEST))).toEqual({
      kind: 'unchanged',
    });
  });

  it('leaves a title test that does not read the heading alone', () => {
    const source = spec(`  it('should render title', () => {
    expect(TestBed.createComponent(App)).toBeTruthy();
  });`);

    expect(editAppSpec(typescript, PATH, source)).toEqual({
      kind: 'unchanged',
    });
  });

  it('adds a comment for another test that reads the heading', () => {
    const result = editAppSpec(
      typescript,
      PATH,
      spec(CREATE_TEST, ZONE_TITLE_TEST, OWN_HEADING_TEST),
    );

    expect(result.kind).toBe('manual');
    if (result.kind !== 'manual') {
      throw new Error('expected a comment');
    }
    expect(result.reason).toBe('some tests read the h1 of the welcome page');
    expect(result.content).toContain('// pidrang:   shows the brand');
    expect(result.content).not.toContain("it('should render title'");
    expect(result.content.endsWith(spec(CREATE_TEST, OWN_HEADING_TEST))).toBe(
      true,
    );
    expect(editAppSpec(typescript, PATH, result.content)).toEqual({
      kind: 'unchanged',
    });
  });

  it('removes its comment once the tests it names are gone', () => {
    const first = editAppSpec(
      typescript,
      PATH,
      spec(CREATE_TEST, OWN_HEADING_TEST),
    );
    if (first.kind !== 'manual') {
      throw new Error('expected a comment');
    }
    const fixed = first.content.replace(`\n\n${OWN_HEADING_TEST}`, '');

    expect(editAppSpec(typescript, PATH, fixed)).toEqual({
      kind: 'edited',
      content: spec(CREATE_TEST),
    });
  });

  it('adds a comment without TypeScript when a test reads the heading', () => {
    const source = spec(CREATE_TEST, ZONE_TITLE_TEST);
    const result = editAppSpec(null, PATH, source);

    expect(result.kind).toBe('manual');
    if (result.kind !== 'manual') {
      throw new Error('expected a comment');
    }
    expect(result.reason).toBe('TypeScript is not installed in this app');
    expect(result.content.startsWith('// pidrang:')).toBe(true);
    expect(result.content.endsWith(source)).toBe(true);
    expect(editAppSpec(null, PATH, result.content)).toEqual({
      kind: 'unchanged',
    });
  });

  it('leaves a spec with no heading test alone without TypeScript', () => {
    expect(editAppSpec(null, PATH, spec(CREATE_TEST))).toEqual({
      kind: 'unchanged',
    });
  });

  describe('with the navigation layout', () => {
    const LAYOUT_SPEC = `import { TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { App } from './app';
import { AppLayout } from './layout/app-layout';

describe('App', () => {
  beforeEach(async () => {
    TestBed.overrideComponent(App, {
      remove: { imports: [AppLayout] },
      add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });

    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

${CREATE_TEST}
});
`;

    it('removes the title test and keeps the layout out of the root component test', () => {
      expect(
        editAppSpec(typescript, PATH, spec(CREATE_TEST, ZONE_TITLE_TEST), true),
      ).toEqual({ kind: 'edited', content: LAYOUT_SPEC });
    });

    it('leaves a spec it already edited alone', () => {
      expect(editAppSpec(typescript, PATH, LAYOUT_SPEC, true)).toEqual({
        kind: 'unchanged',
      });
    });

    it('adds a comment when no beforeEach configures the test module', () => {
      const source = spec(CREATE_TEST).replace(
        / {2}beforeEach[\s\S]*?\n {2}\}\);\n\n/,
        '',
      );

      const result = editAppSpec(typescript, PATH, source, true);

      expect(result).toMatchObject({
        kind: 'manual',
        reason: 'no single beforeEach configures the test module',
      });
      const content = result.kind === 'manual' ? result.content : '';
      expect(content).toContain(
        '// pidrang:   TestBed.overrideComponent(App, {',
      );
      expect(content.endsWith(source)).toBe(true);
      expect(editAppSpec(typescript, PATH, content, true)).toEqual({
        kind: 'unchanged',
      });
    });

    it('lists the heading tests and the layout steps without TypeScript', () => {
      const result = editAppSpec(
        null,
        PATH,
        spec(CREATE_TEST, ZONE_TITLE_TEST),
        true,
      );

      const content = result.kind === 'manual' ? result.content : '';
      expect(content).toContain('with the navigation layout, so the app');
      expect(content).toContain(
        "// pidrang:   import { AppLayout } from './layout/app-layout';",
      );
      expect(editAppSpec(null, PATH, content, true)).toEqual({
        kind: 'unchanged',
      });
    });

    it('asks for the layout override without TypeScript even with no heading test', () => {
      expect(editAppSpec(null, PATH, spec(CREATE_TEST), true)).toMatchObject({
        kind: 'manual',
      });
    });
  });
});
