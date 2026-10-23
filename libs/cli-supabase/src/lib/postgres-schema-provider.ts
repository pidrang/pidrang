import { Client } from 'pg';
import {
  IntrospectedColumn,
  SchemaProvider,
  UnavailableAction,
  describeTable,
} from '@pidrang/cli';
import { PostgresConnection, PostgresSsl } from './supabase-connection';
import { postgresTypeToFieldType } from './postgres-field-type';
import { assertPostgrestTableName } from './assert-postgrest-table-name';
import { postgrestNameProblem } from './postgrest-name-problem';

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
      assertPostgrestTableName(table);
      return withClient(connection, async (client) => {
        const relation = await client.query<{ table_type: string }>(
          `select table_type
           from information_schema.tables
           where table_schema = 'public' and table_name = $1`,
          [table],
        );
        if (relation.rows[0]?.table_type !== 'BASE TABLE') {
          throw new Error(
            `"${table}" is not a table in the public schema. The direct database connection strategy only scaffolds tables, not views or functions.`,
          );
        }
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
        if (primaryKey.rows[0].column_name !== 'id') {
          throw new Error(
            `Table "${table}" has a primary key named "${primaryKey.rows[0].column_name}", not "id". pidrang only supports a primary key column named "id".`,
          );
        }

        const primaryKeyColumn = primaryKey.rows[0].column_name;

        const result = await client.query<{
          column_name: string;
          data_type: string;
          udt_name: string;
          column_default: string | null;
          is_nullable: 'YES' | 'NO';
          is_identity: 'YES' | 'NO';
          identity_generation: 'ALWAYS' | 'BY DEFAULT' | null;
          is_generated: 'ALWAYS' | 'NEVER';
        }>(
          `select column_name, data_type, udt_name, column_default, is_nullable,
                  is_identity, identity_generation, is_generated
           from information_schema.columns
           where table_schema = 'public' and table_name = $1
           order by ordinal_position`,
          [table],
        );
        const columns = result.rows.map((row): IntrospectedColumn => {
          const isPrimaryKey = row.column_name === primaryKeyColumn;
          const isGenerated = row.is_generated === 'ALWAYS';
          const isAlwaysIdentity = row.identity_generation === 'ALWAYS';
          const nameProblem = postgrestNameProblem(row.column_name);
          return {
            name: row.column_name,
            type: nameProblem
              ? { unsupported: nameProblem }
              : postgresTypeToFieldType(row.data_type, row.udt_name),
            readOnly:
              isPrimaryKey || isGenerated || isAlwaysIdentity || undefined,
            hasDefault:
              row.column_default !== null || row.is_identity === 'YES'
                ? true
                : undefined,
            nullable: row.is_nullable === 'YES' ? true : undefined,
          };
        });
        const id = columns.find((column) => column.name === 'id');
        const unavailableActions: UnavailableAction[] = id?.hasDefault
          ? []
          : [
              {
                action: 'create',
                reason:
                  '"id" has no server default and the create form never asks for it',
              },
            ];
        return describeTable(table, columns, unavailableActions);
      });
    },

    async readsNeedSignIn(table) {
      assertPostgrestTableName(table);
      return withClient(connection, async (client) => {
        const result = await client.query<{
          row_security: boolean;
          restrictive_policies: string;
          unconditional_policies: string;
        }>(
          `select c.relrowsecurity as row_security,
                  count(p.*) filter (where not p.polpermissive) as restrictive_policies,
                  count(p.*) filter (
                    where p.polpermissive
                      and coalesce(btrim(pg_get_expr(p.polqual, p.polrelid)), 'true') in ('true', '(true)')
                  ) as unconditional_policies
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
           left join pg_policy p
             on p.polrelid = c.oid
            and p.polcmd in ('r', '*')
            and (
              p.polroles = '{0}'::oid[]
              or exists (
                select 1 from pg_roles r
                where r.oid = any(p.polroles) and r.rolname = 'anon'
              )
            )
           where n.nspname = 'public' and c.relname = $1 and c.relkind in ('r', 'p')
           group by c.relrowsecurity`,
          [table],
        );
        const row = result.rows[0];
        if (!row) {
          return null;
        }
        if (!row.row_security) {
          return false;
        }
        return !(
          Number(row.restrictive_policies) === 0 &&
          Number(row.unconditional_policies) > 0
        );
      });
    },
  };
}
