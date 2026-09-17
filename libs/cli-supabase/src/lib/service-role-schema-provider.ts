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

export function createServiceRoleSchemaProvider(
  connection: ServiceRoleConnection,
): SchemaProvider {
  return {
    async listTables() {
      const schema = await fetchSchema(connection);
      return Object.keys(schema.definitions ?? {});
    },

    async introspectTable(table) {
      const schema = await fetchSchema(connection);
      const properties = schema.definitions?.[table]?.properties ?? {};
      return Object.entries(properties).map(
        ([name, property]): Field => ({
          name,
          type: openApiPropertyToFieldType(property.type, property.format),
        }),
      );
    },
  };
}
