import { Field } from './field';
import {
  buildResourcePayload,
  normalizeResourceValue,
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

  it('never sends a readOnly field, even if the caller left it in fields and it is dirty', () => {
    const fields = [
      field({ name: 'id', readOnly: true }),
      field({ name: 'name' }),
    ];
    const payload = buildResourcePayload(
      'edit',
      fields,
      { id: 'tampered', name: 'Widget' },
      () => true,
    );
    expect(payload).toEqual({ name: 'Widget' });
  });

  it('never sends a readOnly field on create either', () => {
    const fields = [
      field({ name: 'id', readOnly: true }),
      field({ name: 'name' }),
    ];
    const payload = buildResourcePayload(
      'create',
      fields,
      { id: 'tampered', name: 'Widget' },
      () => false,
    );
    expect(payload).toEqual({ name: 'Widget' });
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

describe('normalizeResourceValue', () => {
  it('stringifies a numeric field that arrived as a JS number', () => {
    const fields = [field({ name: 'amount', type: 'numeric' })];
    expect(normalizeResourceValue(fields, { amount: 1 })).toEqual({
      amount: '1',
    });
  });

  it('turns a null text-bound field into an empty string', () => {
    const fields = [field({ name: 'starts_at', type: 'timestamp' })];
    expect(normalizeResourceValue(fields, { starts_at: null })).toEqual({
      starts_at: '',
    });
  });

  it('turns a Date instance into a plain string for a date field', () => {
    const fields = [field({ name: 'available_on', type: 'date' })];
    const result = normalizeResourceValue(fields, {
      available_on: new Date('2024-06-01T00:00:00.000Z'),
    });
    expect(typeof result.available_on).toBe('string');
  });

  it('leaves an already-string text-bound value unchanged', () => {
    const fields = [field({ name: 'amount', type: 'numeric' })];
    expect(
      normalizeResourceValue(fields, { amount: '12345678901234.5678' }),
    ).toEqual({ amount: '12345678901234.5678' });
  });

  it('leaves a plain number field alone', () => {
    const fields = [field({ name: 'quantity', type: 'number' })];
    expect(normalizeResourceValue(fields, { quantity: 5 })).toEqual({
      quantity: 5,
    });
  });

  it('leaves a field with no matching schema entry unchanged', () => {
    const fields: Field[] = [];
    expect(normalizeResourceValue(fields, { mystery: 42 })).toEqual({
      mystery: 42,
    });
  });
});
