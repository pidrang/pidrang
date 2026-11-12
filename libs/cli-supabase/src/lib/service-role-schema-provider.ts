import {
  CrudAction,
  IntrospectedColumn,
  SchemaProvider,
  UnavailableAction,
  describeTable,
} from '@pidrang/cli';
import { ServiceRoleConnection } from './supabase-connection';
import {
  OpenApiProperty,
  openApiPropertyToFieldType,
} from './service-role-field-type';
import { assertPostgrestTableName } from './assert-postgrest-table-name';
import { postgrestNameProblem } from './postgrest-name-problem';
import {
  publishableKeyError,
  rejectedKeyError,
} from './supabase-connection-error';
import { supabaseFetch } from './supabase-fetch';

interface OpenApiDefinition {
  properties?: Record<string, OpenApiProperty>;
  required?: string[];
}

interface OpenApiSchema {
  definitions?: Record<string, OpenApiDefinition>;
  paths?: Record<string, Record<string, unknown>>;
}

const WRITE_METHODS: { action: CrudAction; method: string }[] = [
  { action: 'create', method: 'post' },
  { action: 'edit', method: 'patch' },
  { action: 'delete', method: 'delete' },
];

async function fetchSchema(
  connection: ServiceRoleConnection,
): Promise<OpenApiSchema> {
  const publishable = publishableKeyError(connection.serviceRoleKey);
  if (publishable) {
    throw publishable;
  }
  const response = await supabaseFetch(`${connection.url}/rest/v1/`, {
    headers: {
      apikey: connection.serviceRoleKey,
      Authorization: `Bearer ${connection.serviceRoleKey}`,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    const problem = rejectedKeyError('secret', response.status, body);
    if (problem) {
      throw problem;
    }
    throw new Error(
      `Failed to fetch Supabase OpenAPI schema: ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as OpenApiSchema;
}

function hasUsableProperties(
  definition: OpenApiDefinition | undefined,
): boolean {
  return Object.keys(definition?.properties ?? {}).length > 0;
}

function tableMethods(
  schema: OpenApiSchema,
  table: string,
): Record<string, unknown> | undefined {
  return schema.paths?.[`/${table}`];
}

function isReadableTable(schema: OpenApiSchema, table: string): boolean {
  return (
    hasUsableProperties(schema.definitions?.[table]) &&
    tableMethods(schema, table)?.['get'] !== undefined
  );
}

const PRIMARY_KEY_MARKER = '<pk/>';

function primaryKeyColumns(
  definition: OpenApiDefinition | undefined,
): string[] {
  return Object.entries(definition?.properties ?? {})
    .filter(([, property]) =>
      property.description?.includes(PRIMARY_KEY_MARKER),
    )
    .map(([name]) => name);
}

const FOREIGN_KEY_MARKER = '<fk ';

function isForeignKey(property: OpenApiProperty): boolean {
  return property.description?.includes(FOREIGN_KEY_MARKER) ?? false;
}

function sequenceReason(column: string): string {
  return `PostgREST does not show whether "${column}" is filled by a sequence (serial or identity); use the direct database connection strategy, or set create: true in resources.ts if it has no default`;
}

function sequenceBlindCreate(
  properties: Record<string, OpenApiProperty>,
  required: string[],
  primaryKey: string[],
): UnavailableAction[] {
  return Object.entries(properties)
    .filter(
      ([name, property]) =>
        property.type === 'integer' &&
        required.includes(name) &&
        !('default' in property) &&
        !primaryKey.includes(name) &&
        !isForeignKey(property) &&
        postgrestNameProblem(name) === null,
    )
    .map(
      ([name]): UnavailableAction => ({
        action: 'create',
        reason: sequenceReason(name),
      }),
    );
}

export function createServiceRoleSchemaProvider(
  connection: ServiceRoleConnection,
): SchemaProvider {
  return {
    async listTables() {
      const schema = await fetchSchema(connection);
      return Object.keys(schema.definitions ?? {}).filter((table) =>
        isReadableTable(schema, table),
      );
    },

    async introspectTable(table) {
      assertPostgrestTableName(table);
      const schema = await fetchSchema(connection);
      const definition = schema.definitions?.[table];
      if (!isReadableTable(schema, table)) {
        throw new Error(
          `"${table}" is not a table or view PostgREST serves with columns. pidrang cannot scaffold it; this is usually an RPC function, not a table.`,
        );
      }
      const primaryKey = primaryKeyColumns(definition);
      if (primaryKey.length === 0) {
        throw new Error(
          `Table "${table}" has no primary key. pidrang needs a single primary key column named "id" to identify records.`,
        );
      }
      if (primaryKey.length > 1) {
        throw new Error(
          `Table "${table}" has a composite primary key (${primaryKey.join(', ')}). pidrang only supports a single-column primary key.`,
        );
      }
      if (primaryKey[0] !== 'id') {
        throw new Error(
          `Table "${table}" has a primary key named "${primaryKey[0]}", not "id". pidrang only supports a primary key column named "id".`,
        );
      }
      const properties = definition?.properties ?? {};
      const required = definition?.required ?? [];
      const columns = Object.entries(properties).map(
        ([name, property]): IntrospectedColumn => {
          const nameProblem = postgrestNameProblem(name);
          return {
            name,
            type: nameProblem
              ? { unsupported: nameProblem }
              : openApiPropertyToFieldType(property),
            readOnly: primaryKey.includes(name) || undefined,
            hasDefault: 'default' in property ? true : undefined,
            nullable: required.includes(name) ? undefined : true,
          };
        },
      );
      const methods = tableMethods(schema, table) ?? {};
      const unavailableActions = WRITE_METHODS.filter(
        ({ method }) => methods[method] === undefined,
      ).map(
        ({ action, method }): UnavailableAction => ({
          action,
          reason: `PostgREST does not accept ${method.toUpperCase()} on "${table}", for example a view that cannot be updated`,
        }),
      );
      return describeTable(table, columns, [
        ...unavailableActions,
        ...sequenceBlindCreate(properties, required, primaryKey),
      ]);
    },
  };
}
