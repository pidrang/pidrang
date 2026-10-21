export interface GraphQlConnection {
  strategy: 'graphql';
  url: string;
  anonKey: string;
}

export interface ServiceRoleConnection {
  strategy: 'service-role';
  url: string;
  serviceRoleKey: string;
}

export type PostgresSsl = true | { ca: string };

export interface PostgresConnection {
  strategy: 'postgres';
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: PostgresSsl;
  url?: string;
}

export type SupabaseConnection =
  | GraphQlConnection
  | ServiceRoleConnection
  | PostgresConnection;
