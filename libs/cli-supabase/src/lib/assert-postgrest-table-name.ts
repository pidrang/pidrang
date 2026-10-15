import { postgrestNameProblem } from './postgrest-name-problem';

export function assertPostgrestTableName(table: string): void {
  const problem = postgrestNameProblem(table);
  if (problem) {
    throw new Error(
      `Table "${table}" cannot be scaffolded: it has ${problem}. Rename the table to use it with pidrang.`,
    );
  }
}
