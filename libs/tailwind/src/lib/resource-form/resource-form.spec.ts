import { TestBed } from '@angular/core/testing';

import { ResourceForm } from './resource-form';

describe('ResourceForm', () => {
  it('pre-fills each control from the initial value', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'name', type: 'text' },
      { name: 'price', type: 'number' },
    ]);
    fixture.componentRef.setInput('value', { name: 'USB-C dock', price: 129 });
    await fixture.whenStable();

    const inputs = fixture.nativeElement.querySelectorAll('input');
    expect((inputs[0] as HTMLInputElement).value).toBe('USB-C dock');
    expect((inputs[1] as HTMLInputElement).value).toBe('129');
  });

  it('emits only the edited field on save in edit mode, without mutating the value input', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    const initial = { name: 'USB-C dock', price: 129 };
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'name', type: 'text' },
      { name: 'price', type: 'number' },
    ]);
    fixture.componentRef.setInput('value', initial);
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const priceInput = fixture.nativeElement.querySelectorAll('input')[1];
    priceInput.value = '99';
    priceInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ price: 99 }]);
    expect(initial).toEqual({ name: 'USB-C dock', price: 129 });
  });

  it('sends every field on create, even an untouched one without a server default', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('fields', [
      { name: 'name', type: 'text' },
      { name: 'price', type: 'number' },
    ]);
    fixture.componentRef.setInput('value', { name: 'USB-C dock', price: 129 });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ name: 'USB-C dock', price: 129 }]);
  });

  it('renders a checkbox for a boolean field', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'active', type: 'boolean' },
    ]);
    fixture.componentRef.setInput('value', { active: false });
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector('input[type="checkbox"]'),
    ).toBeTruthy();
  });

  it('disables save and ignores submits while pending', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('fields', [{ name: 'name', type: 'text' }]);
    fixture.componentRef.setInput('value', { name: 'USB-C dock' });
    fixture.componentRef.setInput('pending', true);
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('button');
    const formElement: HTMLFormElement =
      fixture.nativeElement.querySelector('form');
    formElement.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(button.disabled).toBe(true);
    expect(button.textContent?.trim()).toBe('Saving…');
    expect(formElement.getAttribute('aria-busy')).toBe('true');
    expect(saved).toEqual([]);

    fixture.componentRef.setInput('pending', false);
    await fixture.whenStable();
    button.click();
    await fixture.whenStable();

    expect(button.disabled).toBe(false);
    expect(saved).toEqual([{ name: 'USB-C dock' }]);
  });

  it('omits an untouched field that has a server default on create, but keeps other fields', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('fields', [
      { name: 'name', type: 'text' },
      { name: 'status', type: 'text', hasDefault: true },
    ]);
    fixture.componentRef.setInput('value', { name: 'Widget', status: '' });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ name: 'Widget' }]);
  });

  it('shows a hint on an untouched field with a server default, on create', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('fields', [
      { name: 'status', type: 'text', hasDefault: true },
    ]);
    fixture.componentRef.setInput('value', { status: '' });
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(
      'Leave unchanged to use the database default.',
    );
  });

  it('sends an explicit falsy value for a touched field that has a server default', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('fields', [
      { name: 'active', type: 'boolean', hasDefault: true },
    ]);
    fixture.componentRef.setInput('value', { active: true });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    );
    checkbox.click();
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ active: false }]);
  });

  it('blocks submit and shows a message for a malformed timestamp', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'starts_at', type: 'timestamp' },
    ]);
    fixture.componentRef.setInput('value', {
      starts_at: '2024-01-01T10:00:00',
    });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = 'not-a-timestamp';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Enter a timestamp');
  });

  it('omits every untouched field on edit, even one without a server default, preserving full numeric precision', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'name', type: 'text' },
      { name: 'amount', type: 'numeric' },
    ]);
    fixture.componentRef.setInput('value', {
      name: 'Widget',
      amount: '12345678901234.5678',
    });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const nameInput = fixture.nativeElement.querySelectorAll('input')[0];
    nameInput.value = 'Widget v2';
    nameInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ name: 'Widget v2' }]);
  });

  it('sends a touched numeric value unchanged on edit, preserving full precision', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'amount', type: 'numeric' },
    ]);
    fixture.componentRef.setInput('value', { amount: '1.00' });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = '12345678901234.5678';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ amount: '12345678901234.5678' }]);
  });

  it('converts an emptied, nullable timestamp to null instead of sending an empty string', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'starts_at', type: 'timestamp', nullable: true },
    ]);
    fixture.componentRef.setInput('value', {
      starts_at: '2024-01-01T10:00:00',
    });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ starts_at: null }]);
  });

  it('blocks save when a non-nullable timestamp is cleared', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'starts_at', type: 'timestamp' },
    ]);
    fixture.componentRef.setInput('value', {
      starts_at: '2024-01-01T10:00:00',
    });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([]);
  });

  it('blocks create when a required typed field is left at its blank default, even untouched', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('fields', [
      { name: 'starts_at', type: 'timestamp' },
    ]);
    fixture.componentRef.setInput('value', { starts_at: '' });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([]);
  });

  it('round-trips a valid zoned timestamp unchanged on create', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('fields', [
      { name: 'starts_at', type: 'timestamp' },
    ]);
    fixture.componentRef.setInput('value', {
      starts_at: '2024-01-01T10:00:00+02:00',
    });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ starts_at: '2024-01-01T10:00:00+02:00' }]);
  });

  it('does not block an edit save over an untouched field with a pre-existing invalid value, and still sends it unchanged if dirtied', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'name', type: 'text' },
      { name: 'starts_at', type: 'timestamp' },
    ]);
    fixture.componentRef.setInput('value', {
      name: 'Widget',
      starts_at: 'not-a-timestamp',
    });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const nameInput = fixture.nativeElement.querySelectorAll('input')[0];
    nameInput.value = 'Widget v2';
    nameInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ name: 'Widget v2' }]);
  });

  it('preserves an explicit null value for a field without a server default, left untouched on create', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('fields', [
      { name: 'name', type: 'text' },
      { name: 'notes', type: 'text', nullable: true },
    ]);
    fixture.componentRef.setInput('value', { name: 'Widget', notes: null });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ name: 'Widget', notes: null }]);
  });

  it('sends an explicit 0 for a touched number field', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'quantity', type: 'number' },
    ]);
    fixture.componentRef.setInput('value', { quantity: 5 });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = '0';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ quantity: 0 }]);
  });

  it('does not block create over an untouched, non-nullable, typed field that has a server default', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('fields', [
      { name: 'created_at', type: 'timestamp', hasDefault: true },
    ]);
    fixture.componentRef.setInput('value', { created_at: '' });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{}]);
  });

  it('blocks create over a hasDefault field once the user clears it themselves', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('fields', [
      { name: 'created_at', type: 'timestamp', hasDefault: true },
    ]);
    fixture.componentRef.setInput('value', {
      created_at: '2024-01-01T10:00:00',
    });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([]);
  });

  it('preserves full precision of a dirty numeric field even when it loaded as a JS number', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'amount', type: 'numeric' },
    ]);
    fixture.componentRef.setInput('value', { amount: 1 });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = '9007199254740993';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ amount: '9007199254740993' }]);
  });

  it('saves a date field typed into after loading as null as a plain date string, not a Date', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'available_on', type: 'date', nullable: true },
    ]);
    fixture.componentRef.setInput('value', { available_on: null });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = '2024-06-01';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ available_on: '2024-06-01' }]);
  });

  it('does not emit save on edit when nothing was actually changed', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [{ name: 'name', type: 'text' }]);
    fixture.componentRef.setInput('value', { name: 'Widget' });
    await fixture.whenStable();

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([]);
  });

  it('never renders or sends a readOnly field, even if the caller forgot to filter it out', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('fields', [
      { name: 'id', type: 'text', readOnly: true },
      { name: 'name', type: 'text' },
    ]);
    fixture.componentRef.setInput('value', { id: 'abc-123', name: 'Widget' });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('input').length).toBe(1);

    const saved: unknown[] = [];
    fixture.componentInstance.save.subscribe((value: unknown) =>
      saved.push(value),
    );

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = 'Widget v2';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(saved).toEqual([{ name: 'Widget v2' }]);
  });

  it('shows the inline hint for a blank required field after a blocked submit attempt, even though it was never touched', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('fields', [
      { name: 'starts_at', type: 'timestamp' },
    ]);
    fixture.componentRef.setInput('value', { starts_at: '' });
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).not.toContain(
      'Enter a timestamp',
    );

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Enter a timestamp');
  });
});
