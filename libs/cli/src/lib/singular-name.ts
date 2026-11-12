const NON_PLURAL_SUFFIXES = ['ss', 'us', 'is'];
const ES_SUFFIXES = ['sses', 'xes', 'ches', 'shes'];

export function singularName(name: string): string | undefined {
  const lower = name.toLowerCase();

  if (
    lower === 'news' ||
    NON_PLURAL_SUFFIXES.some((suffix) => lower.endsWith(suffix))
  ) {
    return undefined;
  }
  if (lower.endsWith('ies')) {
    return `${name.slice(0, -3)}y`;
  }
  if (ES_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return name.slice(0, -2);
  }
  if (lower.endsWith('s')) {
    return name.slice(0, -1);
  }
  return undefined;
}
