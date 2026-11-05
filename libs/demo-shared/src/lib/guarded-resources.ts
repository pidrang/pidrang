const GUARDED = new WeakMap<object, readonly string[]>();

export function registerGuardedResources(
  guard: object,
  resources: readonly string[],
): void {
  GUARDED.set(guard, [...resources]);
}

export function guardedResourcesOf(guard: object): readonly string[] {
  return GUARDED.get(guard) ?? [];
}
