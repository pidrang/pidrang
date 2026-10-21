import { AppSetup } from './app-setup';
import { SchemaProvider } from './schema-provider';

export type PlanEnvironment = Readonly<Record<string, string | undefined>>;

export interface SchemaProviderDefinition<TConnection = unknown> {
  id: string;
  label: string;
  planHelp: string;

  promptConnection(): Promise<TConnection>;

  connectionFromPlan(
    connection: unknown,
    env: PlanEnvironment,
    warn?: (message: string) => void,
  ): Promise<TConnection>;

  createSchemaProvider(connection: TConnection): SchemaProvider;

  appSetup(connection: TConnection): AppSetup;
}
