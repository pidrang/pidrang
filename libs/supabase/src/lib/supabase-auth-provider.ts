import { AuthIdentity, AuthProvider, LoginParams } from '@pidrang/core';
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseAuthProvider implements AuthProvider {
  constructor(private readonly client: SupabaseClient) {}

  async login(params: LoginParams): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword(params);
    if (error) {
      throw new Error(error.message);
    }
  }

  async logout(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  async getIdentity(): Promise<AuthIdentity | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    return { id: data.user.id, email: data.user.email };
  }
}
