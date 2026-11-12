export const NG_NEW_INITIAL_WARNING = '500kB';
export const NG_NEW_INITIAL_ERROR = '1MB';
export const RAISED_INITIAL_WARNING = '850kB';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNgNewInitialBudget(
  value: unknown,
): value is Record<string, unknown> {
  return (
    isObject(value) &&
    value['type'] === 'initial' &&
    value['maximumWarning'] === NG_NEW_INITIAL_WARNING &&
    value['maximumError'] === NG_NEW_INITIAL_ERROR
  );
}

export function raiseInitialBudget(
  workspaceText: string,
  project: string,
): string | null {
  let workspace: unknown;
  try {
    workspace = JSON.parse(workspaceText);
  } catch {
    return null;
  }
  if (!isObject(workspace) || !isObject(workspace['projects'])) {
    return null;
  }
  const projectDefinition = workspace['projects'][project];
  if (!isObject(projectDefinition)) {
    return null;
  }
  const targets =
    projectDefinition['architect'] ?? projectDefinition['targets'];
  if (!isObject(targets) || !isObject(targets['build'])) {
    return null;
  }
  const build = targets['build'];
  const configurations = build['configurations'];
  const defaultConfiguration = build['defaultConfiguration'];
  if (!isObject(configurations) || typeof defaultConfiguration !== 'string') {
    return null;
  }
  const configuration = configurations[defaultConfiguration];
  if (!isObject(configuration) || !Array.isArray(configuration['budgets'])) {
    return null;
  }
  const budgets: unknown[] = configuration['budgets'];
  const initial = budgets.filter(
    (budget) => isObject(budget) && budget['type'] === 'initial',
  );
  const [only] = initial;
  if (initial.length !== 1 || !isNgNewInitialBudget(only)) {
    return null;
  }
  only['maximumWarning'] = RAISED_INITIAL_WARNING;
  return `${JSON.stringify(workspace, null, 2)}\n`;
}
