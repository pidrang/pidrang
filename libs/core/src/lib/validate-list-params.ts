import { ListParams } from './list-params';

function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function validateListParams(params: ListParams | undefined): void {
  const pagination = params?.pagination;
  if (pagination === undefined) {
    return;
  }
  for (const key of ['current', 'pageSize'] as const) {
    const value = pagination[key];
    if (value !== undefined && !isPositiveInteger(value)) {
      throw new Error(
        `Invalid pagination.${key}: expected a positive integer, got ${String(value)}`,
      );
    }
  }
}
