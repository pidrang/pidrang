import { Field } from './field';
import {
  buildResourcePayload,
  normalizeResourceValue,
  ResourceFormMode,
  shouldBlockSubmit,
} from './resource-form-payload';

function field(overrides: Partial<Field>): Field {
  return { name: 'value', type: 'text', ...overrides };
}

describe('buildResourcePayload', () => {
  it('omits any untouched field, with or without a server default, keeps the rest', () => {
    const fields = [
      field({ name: 'name' }),
      field({ name: 'status', hasDefault: true }),
    ];
    const payload = buildResourcePayload(
      'create',
      fields,
      { name: 'Widget', status: '' },
      (name) => name === 'name',
    );
    expect(payload).toEqual({ name: 'Widget' });
  });

  it('omits an untouched, nullable, plain text field instead of sending an empty string', () => {
    const fields = [field({ name: 'note', nullable: true })];
    const payload = buildResourcePayload(
      'create',
      fields,
      { note: '' },
      () => false,
    );
    expect(payload).toEqual({});
  });

  it('sends a touched field with a server default', () => {
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

  it('preserves full precision of a touched numeric value unchanged', () => {
    const fields = [field({ name: 'amount', type: 'numeric' })];
    const payload = buildResourcePayload(
      'create',
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
      'create',
      fields,
      { starts_at: '' },
      () => true,
    );
    expect(payload).toEqual({ starts_at: null });
  });

  it('does not convert an empty non-nullable field to null', () => {
    const fields = [field({ name: 'starts_at', type: 'timestamp' })];
    const payload = buildResourcePayload(
      'create',
      fields,
      { starts_at: '' },
      () => true,
    );
    expect(payload).toEqual({ starts_at: '' });
  });

  it('does not convert an empty plain text field to null', () => {
    const fields = [field({ name: 'name', nullable: true })];
    const payload = buildResourcePayload(
      'create',
      fields,
      { name: '' },
      () => true,
    );
    expect(payload).toEqual({ name: '' });
  });

  it('sends an explicit 0 for a touched number field', () => {
    const fields = [field({ name: 'quantity', type: 'number' })];
    const payload = buildResourcePayload(
      'create',
      fields,
      { quantity: 0 },
      () => true,
    );
    expect(payload).toEqual({ quantity: 0 });
  });

  it('preserves an explicit null for a touched field', () => {
    const fields = [field({ name: 'notes', nullable: true })];
    const payload = buildResourcePayload(
      'create',
      fields,
      { notes: null },
      () => true,
    );
    expect(payload).toEqual({ notes: null });
  });

  it('never sends a readOnly field, even if the caller left it in fields and it is dirty', () => {
    const fields = [
      field({ name: 'id', readOnly: true }),
      field({ name: 'name' }),
    ];
    const payload = buildResourcePayload(
      'create',
      fields,
      { id: 'tampered', name: 'Widget' },
      () => true,
    );
    expect(payload).toEqual({ name: 'Widget' });
  });
});

describe('buildResourcePayload on edit', () => {
  it('omits any untouched field, with or without flags', () => {
    const fields = [
      field({ name: 'name' }),
      field({ name: 'note', nullable: true }),
      field({ name: 'status', hasDefault: true }),
      field({ name: 'quantity', type: 'number' }),
      field({ name: 'in_stock', type: 'boolean' }),
    ];
    const payload = buildResourcePayload(
      'edit',
      fields,
      {
        name: 'Widget',
        note: '',
        status: 'draft',
        quantity: 3,
        in_stock: false,
      },
      () => false,
    );
    expect(payload).toEqual({});
  });
});

describe('buildResourcePayload for an untouched field shown as a value', () => {
  const flagCases: {
    mode: ResourceFormMode;
    hasDefault: boolean;
    nullable: boolean;
    sent: boolean;
  }[] = [
    { mode: 'create', hasDefault: false, nullable: false, sent: true },
    { mode: 'create', hasDefault: false, nullable: true, sent: true },
    { mode: 'create', hasDefault: true, nullable: false, sent: false },
    { mode: 'create', hasDefault: true, nullable: true, sent: false },
    { mode: 'edit', hasDefault: false, nullable: false, sent: false },
    { mode: 'edit', hasDefault: false, nullable: true, sent: false },
    { mode: 'edit', hasDefault: true, nullable: false, sent: false },
    { mode: 'edit', hasDefault: true, nullable: true, sent: false },
  ];
  const cases = [
    ...flagCases.map((c) => ({ ...c, type: 'boolean' as const, shown: false })),
    ...flagCases.map((c) => ({ ...c, type: 'number' as const, shown: 0 })),
  ];

  it.each(cases)(
    '$type on $mode, hasDefault $hasDefault, nullable $nullable: sent $sent',
    ({ type, shown, mode, hasDefault, nullable, sent }) => {
      const fields = [field({ name: 'value', type, hasDefault, nullable })];
      const payload = buildResourcePayload(
        mode,
        fields,
        { value: shown },
        () => false,
      );
      expect(payload).toEqual(sent ? { value: shown } : {});
    },
  );

  it.each(['text', 'date', 'timestamp', 'time', 'numeric'] as const)(
    'on create, still omits an untouched empty %s field without a default',
    (type) => {
      const fields = [field({ name: 'value', type })];
      const payload = buildResourcePayload(
        'create',
        fields,
        { value: '' },
        () => false,
      );
      expect(payload).toEqual({});
    },
  );

  it('on edit, sends only the renamed field next to an untouched number', () => {
    const fields = [
      field({ name: 'name' }),
      field({ name: 'quantity', type: 'number' }),
    ];
    const payload = buildResourcePayload(
      'edit',
      fields,
      { name: 'Widget v2', quantity: 3 },
      (name) => name === 'name',
    );
    expect(payload).toEqual({ name: 'Widget v2' });
  });

  it('on create, sends a touched number with a default as typed', () => {
    const fields = [
      field({ name: 'quantity', type: 'number', hasDefault: true }),
    ];
    const payload = buildResourcePayload(
      'create',
      fields,
      { quantity: 5 },
      () => true,
    );
    expect(payload).toEqual({ quantity: 5 });
  });

  it('never sends a readOnly number, even on create without a default', () => {
    const fields = [field({ name: 'rank', type: 'number', readOnly: true })];
    const payload = buildResourcePayload(
      'create',
      fields,
      { rank: 0 },
      () => false,
    );
    expect(payload).toEqual({});
  });

  it.each(['create', 'edit'] as const)(
    'on %s, sends a touched boolean whatever its flags',
    (mode) => {
      const fields = [
        field({ name: 'in_stock', type: 'boolean', hasDefault: true }),
      ];
      const payload = buildResourcePayload(
        mode,
        fields,
        { in_stock: true },
        () => true,
      );
      expect(payload).toEqual({ in_stock: true });
    },
  );

  it('on edit, sends only the renamed field next to an untouched boolean', () => {
    const fields = [
      field({ name: 'name' }),
      field({ name: 'in_stock', type: 'boolean' }),
    ];
    const payload = buildResourcePayload(
      'edit',
      fields,
      { name: 'Widget v2', in_stock: false },
      (name) => name === 'name',
    );
    expect(payload).toEqual({ name: 'Widget v2' });
  });

  it('never sends a readOnly boolean, even on create without a default', () => {
    const fields = [field({ name: 'locked', type: 'boolean', readOnly: true })];
    const payload = buildResourcePayload(
      'create',
      fields,
      { locked: false },
      () => false,
    );
    expect(payload).toEqual({});
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
