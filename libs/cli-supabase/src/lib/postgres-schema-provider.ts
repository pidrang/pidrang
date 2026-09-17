import { Client } from 'pg';
import { Field } from '@pidrang/core';
import { SchemaProvider } from '@pidrang/cli';
import { PostgresConnection } from './supabase-connection';
import { postgresTypeToFieldType } from './postgres-field-type';

async function withClient<T>(
  connection: PostgresConnection,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    password: connection.password,
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export function createPostgresSchemaProvider(
  connection: PostgresConnection,
): SchemaProvider {
  return {
    async listTables() {
      return withClient(connection, async (client) => {
        const result = await client.query<{ table_name: string }>(
          `select table_name
           from information_schema.tables
           where table_schema = 'public' and table_type = 'BASE TABLE'
           order by table_name`,
        );
        return result.rows.map((row) => row.table_name);
      });
    },

    async introspectTable(table) {
      return withClient(connection, async (client) => {
        const result = await client.query<{
          column_name: string;
          data_type: string;
        }>(
          `select column_name, data_type
           from information_schema.columns
           where table_schema = 'public' and table_name = $1
           order by ordinal_position`,
          [table],
        );
        return result.rows.map(
          (row): Field => ({
            name: row.column_name,
            type: postgresTypeToFieldType(row.data_type),
          }),
        );
      });
    },
  };
}
