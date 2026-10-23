import { CRUD_ACTIONS, CrudAction } from './crud-action';

export interface TableSelection {
  table: string;
  actions: CrudAction[];
  hiddenFields: string[];
}

export type AppLayoutChoice = 'sidebar' | 'none';

export const APP_LAYOUT_CHOICES: readonly AppLayoutChoice[] = [
  'sidebar',
  'none',
];

export const DEFAULT_SIGN_IN_PATH = '/sign-in';

export interface InitPlan {
  provider: string;
  connection: unknown;
  tables: TableSelection[];
  layout: AppLayoutChoice;
  signIn: boolean;
  readsNeedSignIn: boolean;
}

const PLAN_KEYS = [
  'provider',
  'connection',
  'tables',
  'layout',
  'signIn',
  'readsNeedSignIn',
];
const TABLE_KEYS = ['table', 'actions', 'hiddenFields'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKeyProblems(
  value: Record<string, unknown>,
  allowed: string[],
  where: string,
): string[] {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${where} has an unknown property ${JSON.stringify(key)}`);
}

function duplicates(values: string[]): string[] {
  return [
    ...new Set(
      values.filter((value, index) => values.indexOf(value) !== index),
    ),
  ];
}

function stringListProblems(
  value: unknown,
  where: string,
  allowed?: readonly string[],
): string[] {
  if (!Array.isArray(value)) {
    return [`${where} must be a list`];
  }
  const problems: string[] = [];
  value.forEach((item, index) => {
    if (typeof item !== 'string') {
      problems.push(`${where}[${index}] must be a string`);
    } else if (allowed && !allowed.includes(item)) {
      problems.push(
        `${where}[${index}] must be one of ${allowed.join(', ')}, got ${JSON.stringify(item)}`,
      );
    }
  });
  const repeated = duplicates(
    value.filter((item): item is string => typeof item === 'string'),
  );
  if (repeated.length > 0) {
    problems.push(`${where} repeats ${repeated.join(', ')}`);
  }
  return problems;
}

function tableProblems(value: unknown, index: number): string[] {
  const where = `tables[${index}]`;
  if (!isObject(value)) {
    return [`${where} must be an object`];
  }
  const problems = unknownKeyProblems(value, TABLE_KEYS, where);
  if (typeof value['table'] !== 'string') {
    problems.push(`${where}.table must be a string`);
  }
  if (Array.isArray(value['actions']) && value['actions'].length === 0) {
    problems.push(`${where}.actions must list at least one action`);
  } else {
    problems.push(
      ...stringListProblems(value['actions'], `${where}.actions`, CRUD_ACTIONS),
    );
  }
  if (value['hiddenFields'] !== undefined) {
    problems.push(
      ...stringListProblems(value['hiddenFields'], `${where}.hiddenFields`),
    );
  }
  return problems;
}

function planProblems(value: unknown): string[] {
  if (!isObject(value)) {
    return ['the plan must be a JSON object'];
  }
  const problems = unknownKeyProblems(value, PLAN_KEYS, 'the plan');
  if (typeof value['provider'] !== 'string' || value['provider'] === '') {
    problems.push(
      'provider must be the id of a data source, such as "supabase"',
    );
  }
  if (!isObject(value['connection'])) {
    problems.push('connection must be an object');
  }
  if (
    value['layout'] !== undefined &&
    !APP_LAYOUT_CHOICES.includes(value['layout'] as AppLayoutChoice)
  ) {
    problems.push(
      `layout must be one of ${APP_LAYOUT_CHOICES.map((choice) => JSON.stringify(choice)).join(', ')}`,
    );
  }
  if (value['signIn'] !== undefined && typeof value['signIn'] !== 'boolean') {
    problems.push('signIn must be true or false');
  }
  if (
    value['readsNeedSignIn'] !== undefined &&
    typeof value['readsNeedSignIn'] !== 'boolean'
  ) {
    problems.push('readsNeedSignIn must be true or false');
  }
  const tables = value['tables'];
  if (!Array.isArray(tables) || tables.length === 0) {
    problems.push('tables must list at least one table');
    return problems;
  }
  problems.push(...tables.flatMap(tableProblems));
  const repeated = duplicates(
    tables.flatMap((table) =>
      isObject(table) && typeof table['table'] === 'string'
        ? [table['table']]
        : [],
    ),
  );
  if (repeated.length > 0) {
    problems.push(
      `tables repeats ${repeated.map((table) => JSON.stringify(table)).join(', ')}`,
    );
  }
  return problems;
}

export function parseInitPlan(value: unknown): InitPlan {
  const problems = planProblems(value);
  if (problems.length > 0) {
    throw new Error(`Invalid plan: ${problems.join('; ')}.`);
  }
  const plan = value as Record<string, unknown>;
  return {
    provider: plan['provider'] as string,
    connection: plan['connection'],
    layout: (plan['layout'] as AppLayoutChoice | undefined) ?? 'none',
    signIn: plan['signIn'] === true,
    readsNeedSignIn: plan['readsNeedSignIn'] === true,
    tables: (plan['tables'] as Record<string, unknown>[]).map((table) => ({
      table: table['table'] as string,
      actions: table['actions'] as CrudAction[],
      hiddenFields: (table['hiddenFields'] as string[] | undefined) ?? [],
    })),
  };
}
