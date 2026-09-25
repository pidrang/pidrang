import { AuthIdentity, AuthProvider, LoginParams } from '@pidrang/core';
import {
  AuthChangeEvent,
  SupabaseClient,
  isAuthSessionMissingError,
} from '@supabase/supabase-js';

import { toError } from './to-error';

const SESSION_CHANGE_EVENTS = new Set<AuthChangeEvent>([
  'SIGNED_IN',
  'SIGNED_OUT',
  'USER_UPDATED',
]);

export class SupabaseAuthProvider implements AuthProvider {
  constructor(private readonly client: SupabaseClient) {}

  async login(params: LoginParams): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword(params);
    if (error) {
      throw toError(error);
    }
  }

  async logout(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw toError(error);
    }
  }

  async getIdentity(): Promise<AuthIdentity | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      if (
        isAuthSessionMissingError(error) ||
        error.code === 'session_not_found'
      ) {
        return null;
      }
      throw toError(error);
    }
    return data.user ? { id: data.user.id, email: data.user.email } : null;
  }

  onSessionChange(listener: () => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((event) => {
      if (SESSION_CHANGE_EVENTS.has(event)) {
        setTimeout(listener);
      }
    });
    return () => data.subscription.unsubscribe();
  }
}
