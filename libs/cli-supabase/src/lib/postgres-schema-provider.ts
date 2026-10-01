import { Client } from 'pg';
import { Field } from '@pidrang/core';
import { SchemaProvider } from '@pidrang/cli';
import { PostgresConnection, PostgresSsl } from './supabase-connection';
import { postgresTypeToFieldType } from './postgres-field-type';

function toClientSsl(
  ssl: PostgresSsl | undefined,
): { rejectUnauthorized: true; ca?: string } | undefined {
  if (!ssl) {
    return undefined;
  }
  return ssl === true
    ? { rejectUnauthorized: true }
    : { rejectUnauthorized: true, ca: ssl.ca };
}

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
    ssl: toClientSsl(connection.ssl),
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
        const primaryKey = await client.query<{ column_name: string }>(
          `select kcu.column_name
           from information_schema.table_constraints tc
           join information_schema.key_column_usage kcu
             on kcu.constraint_name = tc.constraint_name
            and kcu.table_schema = tc.table_schema
           where tc.table_schema = 'public'
             and tc.table_name = $1
             and tc.constraint_type = 'PRIMARY KEY'`,
          [table],
        );
        if (primaryKey.rows.length === 0) {
          throw new Error(
            `Table "${table}" has no primary key. pidrang needs a single-column primary key to identify records.`,
          );
        }
        if (primaryKey.rows.length > 1) {
          throw new Error(
            `Table "${table}" has a composite primary key (${primaryKey.rows.map((row) => row.column_name).join(', ')}). pidrang only supports a single-column primary key.`,
          );
        }

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
