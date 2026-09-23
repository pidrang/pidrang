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

// pg_graphql exposes each table as a Relay-style `<table>Collection` field on
// Query, returning `{ edges { node { ...columns, nodeId } } }`. `edges` is
// wrapped as `NON_NULL(LIST(NON_NULL(OBJECT)))` and `node` as
// `NON_NULL(OBJECT)`, and `__Type.fields` is only populated for an
// OBJECT/INTERFACE kind (null otherwise, verified against a real pg_graphql
// schema) — so reaching the actual columns needs `fields` re-queried after
// each `ofType` unwrap, at every hop (Query -> Collection -> edges -> Edge ->
// node -> Node -> columns). GraphQL has no recursive query syntax, so this
// generates a bounded-depth query instead of hand-writing the nesting.
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

// Deep enough to cover Collection -> edges (3 unwraps) -> Edge -> node
// (1 unwrap) -> Node -> columns, with margin.
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

// Walks `ofType` until it finds a level where `fields` is populated (i.e. an
// OBJECT/INTERFACE kind), since a NON_NULL/LIST wrapper's own `fields` is
// always null.
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
      const fields = await runIntrospection(connection);
      const collectionField = fields.find(
        (field) => field.name === `${table}Collection`,
      );
      if (!collectionField) {
        throw new Error(`Table "${table}" not found in Supabase GraphQL schema`);
      }

      const collectionFields = unwrapObjectFields(collectionField.type);
      const edgeFields = findFieldFields(collectionFields, 'edges');
      const nodeFields = findFieldFields(edgeFields, 'node');

      return nodeFields
        .filter((field) => field.name !== 'nodeId' && isScalarField(field))
        .map(
          (field): Field => ({
            name: field.name,
            type: graphqlScalarToFieldType(scalarTypeName(field.type)),
          }),
        );
    },
  };
}
