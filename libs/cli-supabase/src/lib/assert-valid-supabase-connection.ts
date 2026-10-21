import {
  portProblem,
  projectUrlProblem,
  requiredValueProblem,
} from './connection-problems';
import { SupabaseConnection } from './supabase-connection';

function connectionProblems(connection: SupabaseConnection): (string | null)[] {
  switch (connection.strategy) {
    case 'graphql':
      return [
        projectUrlProblem(connection.url),
        requiredValueProblem('The publishable key', connection.anonKey),
      ];
    case 'service-role':
      return [
        projectUrlProblem(connection.url),
        requiredValueProblem('The secret key', connection.serviceRoleKey),
      ];
    case 'postgres':
      return [
        requiredValueProblem('The database host', connection.host),
        portProblem(String(connection.port)),
        requiredValueProblem('The database name', connection.database),
        requiredValueProblem('The database user', connection.user),
        connection.ssl && connection.ssl !== true
          ? requiredValueProblem('The CA certificate', connection.ssl.ca)
          : null,
        connection.url === undefined ? null : projectUrlProblem(connection.url),
      ];
    default:
      return [
        `Unknown connection strategy: ${(connection as SupabaseConnection).strategy}`,
      ];
  }
}

export function assertValidSupabaseConnection(
  connection: SupabaseConnection,
): void {
  const problems = connectionProblems(connection).filter(
    (problem): problem is string => problem !== null,
  );
  if (problems.length > 0) {
    throw new Error(`Invalid connection: ${problems.join('; ')}.`);
  }
}
