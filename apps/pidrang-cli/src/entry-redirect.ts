import type { GenerationPlan, TablePlan } from '@pidrang/cli';
import type { ActionState, EntryActions } from './edit-resources';

export type EntryTarget =
  | { kind: 'redirect'; path: string }
  | { kind: 'none' }
  | { kind: 'unknown'; table: string };

export type EntryActionsOf = (table: TablePlan) => EntryActions | null;

function segment(table: TablePlan): string {
  return `/${encodeURIComponent(table.table)}`;
}

export function plannedEntryActions(table: TablePlan): EntryActions {
  const state = (action: 'list' | 'create'): ActionState =>
    table.actions.includes(action) ? 'enabled' : 'disabled';
  return { list: state('list'), create: state('create') };
}

function firstOpening(
  plan: GenerationPlan,
  actionsOf: EntryActionsOf,
  action: keyof EntryActions,
): { table: TablePlan; state: ActionState } | null {
  for (const table of plan.tables) {
    const state = actionsOf(table)?.[action] ?? 'unknown';
    if (state !== 'disabled') {
      return { table, state };
    }
  }
  return null;
}

export function entryRedirect(
  plan: GenerationPlan,
  actionsOf: EntryActionsOf = plannedEntryActions,
): EntryTarget {
  const listed = firstOpening(plan, actionsOf, 'list');
  if (listed !== null) {
    return listed.state === 'enabled'
      ? { kind: 'redirect', path: segment(listed.table) }
      : { kind: 'unknown', table: listed.table.table };
  }
  const creatable = firstOpening(plan, actionsOf, 'create');
  if (creatable === null) {
    return { kind: 'none' };
  }
  return creatable.state === 'enabled'
    ? { kind: 'redirect', path: `${segment(creatable.table)}/create` }
    : { kind: 'unknown', table: creatable.table.table };
}
