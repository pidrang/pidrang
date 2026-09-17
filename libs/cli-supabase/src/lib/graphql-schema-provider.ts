import { Field } from '@pidrang/core';
import { SchemaProvider } from '@pidrang/cli';
import { GraphQlConnection } from './supabase-connection';
import { graphqlScalarToFieldType } from './graphql-field-type';

// pg_graphql exposes each table as a Relay-style `<table>Collection` field on
// Query, returning `{ edges { node { ...columns, nodeId } } }`. This query
// walks that fixed shape rather than a generic recursive introspection.
const INTROSPECTION_QUERY = `
  query IntrospectSchema {
    __schema {
      queryType {
        fields {
          name
          type {
            fields {
              name
              type {
                fields {
                  name
                  type {
                    name
                    kind
                    ofType {
                      name
                      kind
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface IntrospectionType {
  name?: string | null;
  kind?: string;
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
  const body = (await response.json()) as IntrospectionResponse;
  if (body.errors?.length) {
    throw new Error(
      `Supabase GraphQL introspection failed: ${body.errors[0].message}`,
    );
  }
  return body.data?.__schema.queryType.fields ?? [];
}

function findNodeFields(collectionField: IntrospectionField): IntrospectionField[] {
  const edgesField = collectionField.type.fields?.find(
    (field) => field.name === 'edges',
  );
  const nodeField = edgesField?.type.fields?.find(
    (field) => field.name === 'node',
  );
  return nodeField?.type.fields ?? [];
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
      return findNodeFields(collectionField)
        .filter((field) => field.name !== 'nodeId')
        .map(
          (field): Field => ({
            name: field.name,
            type: graphqlScalarToFieldType(scalarTypeName(field.type)),
          }),
        );
    },
  };
}
