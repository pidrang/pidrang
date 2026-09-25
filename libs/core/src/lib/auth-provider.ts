export interface LoginParams {
  email: string;
  password: string;
}

export interface AuthIdentity {
  id: string;
  email?: string;
}

export interface AuthProvider {
  login(params: LoginParams): Promise<void>;

  logout(): Promise<void>;

  getIdentity(): Promise<AuthIdentity | null>;

  onSessionChange?(listener: () => void): () => void;
}
