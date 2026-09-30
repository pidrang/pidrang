const RESERVED = new Set([
  'select',
  'columns',
  'order',
  'limit',
  'offset',
  'on_conflict',
  'or',
  'and',
]);

const SYNTAX = /[.,()]|->/;

export function assertPostgrestField(
  field: string,
  usage: 'filter' | 'sorter',
): void {
  if ((usage === 'filter' && RESERVED.has(field)) || SYNTAX.test(field)) {
    throw new Error(
      `Invalid field "${field}": PostgREST would read it as a query option or a path, not as a column`,
    );
  }
}
