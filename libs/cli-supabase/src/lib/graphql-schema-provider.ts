import {
  IntrospectedColumn,
  SchemaProvider,
  UnavailableAction,
  describeTable,
} from '@pidrang/cli';
import { GraphQlConnection } from './supabase-connection';
import { graphqlScalarToFieldType } from './graphql-field-type';
import { assertPostgrestTableName } from './assert-postgrest-table-name';
import { postgrestNameProblem } from './postgrest-name-problem';
import {
  graphQlDisabledError,
  rejectedKeyError,
} from './supabase-connection-error';
import { supabaseFetch } from './supabase-fetch';

interface IntrospectionType {
  kind?: string;
  name?: string | null;
  ofType?: IntrospectionType | null;
  fields?: IntrospectionField[] | null;
}

interface IntrospectionField {
  name: string;
  type: IntrospectionType;
}

interface GraphQlResponse<T> {
  data?: T;
  errors?: { message: string }[];
  code?: string;
  message?: string;
}

interface SchemaData {
  __schema: {
    queryType: {
      fields: IntrospectionField[];
    };
  };
}

interface InputTypeData {
  __type: { inputFields: { name: string }[] | null } | null;
}

function typeSelection(depth: number): string {
  if (depth <= 0) {
    return `kind name ofType { kind name ofType { kind name } }`;
  }
  return `
    kind
    name
    fields {
      name
      type {
        ${typeSelection(depth - 1)}
      }
    }
    ofType {
      ${typeSelection(depth - 1)}
    }
  `;
}

const INTROSPECTION_QUERY = `
  query IntrospectSchema {
    __schema {
      queryType {
        fields {
          name
          type {
            ${typeSelection(8)}
          }
        }
      }
    }
  }
`;

const INPUT_TYPE_QUERY = `
  query IntrospectInputType($name: String!) {
    __type(name: $name) {
      inputFields {
        name
      }
    }
  }
`;

const UNDEFINED_COLUMN = '42703';
const INSUFFICIENT_PRIVILEGE = '42501';

async function runGraphQl<T>(
  connection: GraphQlConnection,
  query: string,
  variables?: Record<string, string>,
): Promise<T | undefined> {
  const response = await supabaseFetch(`${connection.url}/graphql/v1`, {
    method: 'POST',
    headers: {
      apikey: connection.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json().catch(() => ({}))) as GraphQlResponse<T>;
  const problem =
    graphQlDisabledError(body) ??
    rejectedKeyError('anon key', response.status, body);
  if (problem) {
    throw problem;
  }
  if (!response.ok) {
    throw new Error(
      `Supabase GraphQL introspection failed: ${response.status} ${response.statusText}`,
    );
  }
  if (body.errors?.length) {
    throw new Error(
      `Supabase GraphQL introspection failed: ${body.errors[0].message}`,
    );
  }
  return body.data;
}

async function runIntrospection(
  connection: GraphQlConnection,
): Promise<IntrospectionField[]> {
  const data = await runGraphQl<SchemaData>(connection, INTROSPECTION_QUERY);
  return data?.__schema.queryType.fields ?? [];
}

async function insertableColumns(
  connection: GraphQlConnection,
  nodeTypeName: string,
): Promise<Set<string> | null> {
  const data = await runGraphQl<InputTypeData>(connection, INPUT_TYPE_QUERY, {
    name: `${nodeTypeName}InsertInput`,
  });
  const inputFields = data?.__type?.inputFields;
  return inputFields ? new Set(inputFields.map((field) => field.name)) : null;
}

function unwrapObjectType(
  type: IntrospectionType | null | undefined,
): IntrospectionType | null {
  if (!type) {
    return null;
  }
  return type.fields ? type : unwrapObjectType(type.ofType);
}

function findFieldType(
  fields: IntrospectionField[],
  name: string,
): IntrospectionType | null {
  const field = fields.find((f) => f.name === name);
  return field ? unwrapObjectType(field.type) : null;
}

function withoutNonNull(type: IntrospectionType): IntrospectionType {
  return type.kind === 'NON_NULL' && type.ofType ? type.ofType : type;
}

function columnShape(
  field: IntrospectionField,
): { kind: string; typeName: string } | null {
  const outer = withoutNonNull(field.type);
  if (outer.kind === 'LIST') {
    const inner = outer.ofType ? withoutNonNull(outer.ofType) : null;
    if (inner?.kind === 'SCALAR' || inner?.kind === 'ENUM') {
      return { kind: 'LIST', typeName: inner.name ?? 'an unknown type' };
    }
    return null;
  }
  if (outer.kind === 'SCALAR' || outer.kind === 'ENUM') {
    return { kind: outer.kind, typeName: outer.name ?? 'an unknown type' };
  }
  return null;
}

async function assertRestNames(
  connection: GraphQlConnection,
  table: string,
  columns: string[],
): Promise<void> {
  const select = columns.map((column) => `"${column}"`).join(',');
  const response = await supabaseFetch(
    `${connection.url}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(select)}&limit=0`,
    { headers: { apikey: connection.anonKey } },
  );
  if (response.ok) {
    return;
  }
  const body = (await response.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  };
  const advice =
    'pg_graphql may have renamed it, and pidrang does not guess the real name; use the direct database connection strategy for this table instead.';
  if (response.status === 404) {
    throw new Error(
      `GraphQL lists a table "${table}", but the REST API the generated pages use has no table with that name: ${advice}`,
    );
  }
  if (body.code === UNDEFINED_COLUMN) {
    throw new Error(
      `A GraphQL column of "${table}" is not a column of the REST API the generated pages use (${body.message ?? 'unknown column'}): ${advice}`,
    );
  }
  if (
    response.status === 401 ||
    response.status === 403 ||
    body.code === INSUFFICIENT_PRIVILEGE
  ) {
    throw new Error(
      `pidrang could not check the REST names of "${table}" with this key (${response.status}). Grant select on it to the anon role, or use the direct database connection strategy.`,
    );
  }
  throw new Error(
    `pidrang could not check the REST names of "${table}": ${response.status} ${body.message ?? response.statusText}`,
  );
}

function createAvailability(
  columns: IntrospectedColumn[],
  insertable: Set<string> | null,
): UnavailableAction[] {
  if (!insertable) {
    return [
      {
        action: 'create',
        reason:
          'GraphQL does not show which columns accept a value on insert with this key',
      },
    ];
  }
  const unknownDefaults = columns
    .filter(
      (column) =>
        typeof column.type === 'string' &&
        !column.nullable &&
        insertable.has(column.name),
    )
    .map((column) => `"${column.name}"`);
  if (unknownDefaults.length === 0) {
    return [];
  }
  return [
    {
      action: 'create',
      reason: `GraphQL cannot show whether ${unknownDefaults.join(', ')} ${unknownDefaults.length > 1 ? 'have' : 'has'} a server default; use the direct database connection strategy to generate create`,
    },
  ];
}

export function createGraphQlSchemaProvider(
  connection: GraphQlConnection,
): SchemaProvider {
  return {
    async listTables() {
      const fields = await runIntrospection(connection);
      return fields
        .filter((field) => field.name.endsWith('Collection'))
        .map((field) => field.name.replace(/Collection$/, ''));
    },

    async introspectTable(table) {
      assertPostgrestTableName(table);
      const fields = await runIntrospection(connection);
      const collectionField = fields.find(
        (field) => field.name === `${table}Collection`,
      );
      if (!collectionField) {
        throw new Error(
          `Table "${table}" not found in Supabase GraphQL schema`,
        );
      }

      const collectionFields =
        unwrapObjectType(collectionField.type)?.fields ?? [];
      const edgeFields = findFieldType(collectionFields, 'edges')?.fields ?? [];
      const nodeType = findFieldType(edgeFields, 'node');
      const nodeFields = nodeType?.fields ?? [];

      const shaped = nodeFields
        .filter((field) => field.name !== 'nodeId')
        .flatMap((field) => {
          const shape = columnShape(field);
          return shape ? [{ field, shape }] : [];
        });
      if (!shaped.some(({ field }) => field.name === 'id')) {
        throw new Error(
          `Table "${table}" has no "id" column visible to GraphQL introspection. pidrang only supports a primary key column named "id"; use the direct database connection strategy, which can also confirm there is exactly one primary key column (GraphQL introspection cannot).`,
        );
      }

      const insertable = nodeType?.name
        ? await insertableColumns(connection, nodeType.name)
        : null;
      const columns = shaped.map(({ field, shape }): IntrospectedColumn => {
        const nameProblem = postgrestNameProblem(field.name);
        return {
          name: field.name,
          type: nameProblem
            ? { unsupported: nameProblem }
            : graphqlScalarToFieldType(shape.kind, shape.typeName),
          readOnly:
            field.name === 'id' ||
            (insertable !== null && !insertable.has(field.name)) ||
            undefined,
          nullable: field.type.kind !== 'NON_NULL' || undefined,
        };
      });

      const description = describeTable(
        table,
        columns,
        createAvailability(columns, insertable),
      );
      await assertRestNames(
        connection,
        table,
        description.fields.map((field) => field.name),
      );
      return description;
    },
  };
}
