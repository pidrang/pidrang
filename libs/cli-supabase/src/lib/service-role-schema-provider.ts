import { Field } from '@pidrang/core';
import { SchemaProvider } from '@pidrang/cli';
import { ServiceRoleConnection } from './supabase-connection';
import { openApiPropertyToFieldType } from './service-role-field-type';

interface OpenApiProperty {
  type: string;
  format?: string;
}

interface OpenApiDefinition {
  properties?: Record<string, OpenApiProperty>;
}

interface OpenApiSchema {
  definitions?: Record<string, OpenApiDefinition>;
}

async function fetchSchema(
  connection: ServiceRoleConnection,
): Promise<OpenApiSchema> {
  const response = await fetch(`${connection.url}/rest/v1/`, {
    headers: {
      apikey: connection.serviceRoleKey,
      Authorization: `Bearer ${connection.serviceRoleKey}`,
    },
  });
  if (!response.ok) {
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

export function createServiceRoleSchemaProvider(
  connection: ServiceRoleConnection,
): SchemaProvider {
  return {
    async listTables() {
      const schema = await fetchSchema(connection);
      return Object.entries(schema.definitions ?? {})
        .filter(([, definition]) => hasUsableProperties(definition))
        .map(([table]) => table);
    },

    async introspectTable(table) {
      const schema = await fetchSchema(connection);
      const definition = schema.definitions?.[table];
      if (!hasUsableProperties(definition)) {
        throw new Error(
          `"${table}" has no columns in the Supabase OpenAPI schema. pidrang cannot scaffold a resource with no fields; this is usually an RPC function or a view without a column schema, not a table.`,
        );
      }
      const properties = definition?.properties ?? {};
      return Object.entries(properties).map(
        ([name, property]): Field => ({
          name,
          type: openApiPropertyToFieldType(property.type, property.format),
        }),
      );
    },
  };
}
