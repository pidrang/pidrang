export function postgrestInList(values: readonly unknown[]): string {
  const quoted = values.map(
    (value) =>
      `"${String(value).replace(/[\\"]/g, (character) => `\\${character}`)}"`,
  );
  return `(${quoted.join(',')})`;
}
