import { TestBed } from '@angular/core/testing';

import { ResourceForm } from './resource-form';

describe('ResourceForm', () => {
  it('pre-fills each control from the initial value', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
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

  it('emits the edited value on save, without mutating the value input', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
    const initial = { name: 'USB-C dock', price: 129 };
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

    expect(saved).toEqual([{ name: 'USB-C dock', price: 99 }]);
    expect(initial).toEqual({ name: 'USB-C dock', price: 129 });
  });

  it('renders a checkbox for a boolean field', async () => {
    TestBed.configureTestingModule({ imports: [ResourceForm] });

    const fixture = TestBed.createComponent(ResourceForm);
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
});
