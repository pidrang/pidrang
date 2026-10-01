import { Field } from '@pidrang/core';
import { SchemaProvider } from '@pidrang/cli';
import { GraphQlConnection } from './supabase-connection';
import { graphqlScalarToFieldType } from './graphql-field-type';

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

interface IntrospectionResponse {
  data?: {
    __schema: {
      queryType: {
        fields: IntrospectionField[];
      };
    };
  };
  errors?: { message: string }[];
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

async function runIntrospection(
  connection: GraphQlConnection,
): Promise<IntrospectionField[]> {
  const response = await fetch(`${connection.url}/graphql/v1`, {
    method: 'POST',
    headers: {
      apikey: connection.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: INTROSPECTION_QUERY }),
  });
  if (!response.ok) {
    throw new Error(
      `Supabase GraphQL introspection failed: ${response.status} ${response.statusText}`,
    );
  }
  const body = (await response.json()) as IntrospectionResponse;
  if (body.errors?.length) {
    throw new Error(
      `Supabase GraphQL introspection failed: ${body.errors[0].message}`,
    );
  }
  return body.data?.__schema.queryType.fields ?? [];
}

function unwrapObjectFields(
  type: IntrospectionType | null | undefined,
): IntrospectionField[] {
  if (!type) {
    return [];
  }
  return type.fields ?? unwrapObjectFields(type.ofType);
}

function findFieldFields(
  fields: IntrospectionField[],
  name: string,
): IntrospectionField[] {
  const field = fields.find((f) => f.name === name);
  return field ? unwrapObjectFields(field.type) : [];
}

function isScalarField(field: IntrospectionField): boolean {
  const kind =
    field.type.kind === 'NON_NULL' ? field.type.ofType?.kind : field.type.kind;
  return kind === 'SCALAR' || kind === 'ENUM';
}

function scalarTypeName(type: IntrospectionType): string {
  return type.name ?? type.ofType?.name ?? 'String';
}

const LOOKS_RENAMED_BY_GRAPHQL = /[A-Z]/;

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
      if (LOOKS_RENAMED_BY_GRAPHQL.test(table)) {
        throw new Error(
          `"${table}" does not look like a Postgres table name: pg_graphql may have renamed it when building this GraphQL collection name, or the table may genuinely be named "${table}". pidrang cannot tell which from GraphQL alone, so it cannot scaffold "${table}" from this strategy; use the direct database connection strategy for this table instead.`,
        );
      }

      const fields = await runIntrospection(connection);
      const collectionField = fields.find(
        (field) => field.name === `${table}Collection`,
      );
      if (!collectionField) {
        throw new Error(
          `Table "${table}" not found in Supabase GraphQL schema`,
        );
      }

      const collectionFields = unwrapObjectFields(collectionField.type);
      const edgeFields = findFieldFields(collectionFields, 'edges');
      const nodeFields = findFieldFields(edgeFields, 'node');

      const result = nodeFields
        .filter((field) => field.name !== 'nodeId' && isScalarField(field))
        .map(
          (field): Field => ({
            name: field.name,
            type: graphqlScalarToFieldType(scalarTypeName(field.type)),
          }),
        );
      if (!result.some((field) => field.name === 'id')) {
        throw new Error(
          `Table "${table}" has no "id" column visible to GraphQL introspection. pidrang only supports a primary key column named "id"; use the direct database connection strategy, which can also confirm there is exactly one primary key column (GraphQL introspection cannot).`,
        );
      }
      return result;
    },
  };
}
