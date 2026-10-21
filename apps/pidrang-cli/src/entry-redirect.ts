import type { GenerationPlan, TablePlan } from '@pidrang/cli';

function canOpenTable(table: TablePlan): boolean {
  return table.actions.includes('list') || table.actions.includes('create');
}

function entryPath(table: TablePlan): string {
  return table.actions.includes('list')
    ? `/${encodeURIComponent(table.table)}`
    : `/${encodeURIComponent(table.table)}/create`;
}

export function entryRedirect(plan: GenerationPlan): string | null {
  const table = plan.tables.find(canOpenTable);
  return table === undefined ? null : entryPath(table);
}
