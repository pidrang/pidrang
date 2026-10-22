import type { GenerationPlan, TablePlan } from '@pidrang/cli';

function segment(table: TablePlan): string {
  return `/${encodeURIComponent(table.table)}`;
}

export function entryRedirect(plan: GenerationPlan): string | null {
  const listed = plan.tables.find((table) => table.actions.includes('list'));
  if (listed !== undefined) {
    return segment(listed);
  }
  const creatable = plan.tables.find((table) =>
    table.actions.includes('create'),
  );
  return creatable === undefined ? null : `${segment(creatable)}/create`;
}
