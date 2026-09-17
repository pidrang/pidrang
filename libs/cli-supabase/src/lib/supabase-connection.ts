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

export interface PostgresConnection {
  strategy: 'postgres';
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export type SupabaseConnection =
  | GraphQlConnection
  | ServiceRoleConnection
  | PostgresConnection;
