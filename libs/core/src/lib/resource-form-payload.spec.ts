import { Field } from './field';
import {
  buildResourcePayload,
  shouldBlockSubmit,
} from './resource-form-payload';

function field(overrides: Partial<Field>): Field {
  return { name: 'value', type: 'text', ...overrides };
}

describe('buildResourcePayload', () => {
  it('omits an untouched field with a server default on create, keeps the rest', () => {
    const fields = [
      field({ name: 'name' }),
      field({ name: 'status', hasDefault: true }),
    ];
    const payload = buildResourcePayload(
      'create',
      fields,
      { name: 'Widget', status: '' },
      () => false,
    );
    expect(payload).toEqual({ name: 'Widget' });
  });

  it('sends a touched field with a server default on create', () => {
    const fields = [
      field({ name: 'active', type: 'boolean', hasDefault: true }),
    ];
    const payload = buildResourcePayload(
      'create',
      fields,
      { active: false },
      () => true,
    );
    expect(payload).toEqual({ active: false });
  });

  it('sends every field on create regardless of dirty, except a defaulted one', () => {
    const fields = [
      field({ name: 'name' }),
      field({ name: 'status', hasDefault: true }),
    ];
    const payload = buildResourcePayload(
      'create',
      fields,
      { name: 'Widget', status: '' },
      () => false,
    );
    expect(payload).toEqual({ name: 'Widget' });
  });

  it('on edit, sends only touched fields regardless of hasDefault', () => {
    const fields = [
      field({ name: 'name' }),
      field({ name: 'amount', type: 'numeric' }),
    ];
    const payload = buildResourcePayload(
      'edit',
      fields,
      { name: 'Widget', amount: '12345678901234.5678' },
      (name) => name === 'name',
    );
    expect(payload).toEqual({ name: 'Widget' });
  });

  it('on edit, preserves full precision of a touched numeric value unchanged', () => {
    const fields = [field({ name: 'amount', type: 'numeric' })];
    const payload = buildResourcePayload(
      'edit',
      fields,
      { amount: '12345678901234.5678' },
      () => true,
    );
    expect(payload).toEqual({ amount: '12345678901234.5678' });
  });

  it('converts an emptied, nullable, text-bound field to null', () => {
    const fields = [
      field({ name: 'starts_at', type: 'timestamp', nullable: true }),
    ];
    const payload = buildResourcePayload(
      'edit',
      fields,
      { starts_at: '' },
      () => true,
    );
    expect(payload).toEqual({ starts_at: null });
  });

  it('does not convert an empty non-nullable field to null', () => {
    const fields = [field({ name: 'starts_at', type: 'timestamp' })];
    const payload = buildResourcePayload(
      'edit',
      fields,
      { starts_at: '' },
      () => true,
    );
    expect(payload).toEqual({ starts_at: '' });
  });

  it('does not convert an empty plain text field to null', () => {
    const fields = [field({ name: 'name', nullable: true })];
    const payload = buildResourcePayload(
      'edit',
      fields,
      { name: '' },
      () => true,
    );
    expect(payload).toEqual({ name: '' });
  });

  it('sends an explicit 0 for a touched number field', () => {
    const fields = [field({ name: 'quantity', type: 'number' })];
    const payload = buildResourcePayload(
      'edit',
      fields,
      { quantity: 0 },
      () => true,
    );
    expect(payload).toEqual({ quantity: 0 });
  });

  it('preserves an explicit null for a field without a server default', () => {
    const fields = [field({ name: 'notes', nullable: true })];
    const payload = buildResourcePayload(
      'create',
      fields,
      { notes: null },
      () => false,
    );
    expect(payload).toEqual({ notes: null });
  });
});

describe('shouldBlockSubmit', () => {
  it('blocks on create whenever a field is invalid, even untouched', () => {
    expect(shouldBlockSubmit('create', false, true)).toBe(true);
  });

  it('does not block on create when a field is valid', () => {
    expect(shouldBlockSubmit('create', false, false)).toBe(false);
  });

  it('on edit, blocks only when the invalid field was also touched', () => {
    expect(shouldBlockSubmit('edit', true, true)).toBe(true);
    expect(shouldBlockSubmit('edit', false, true)).toBe(false);
  });
});
