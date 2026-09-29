import { DemoAccount } from './demo-account';

export interface DemoEnvironment {
  supabaseUrl: string;
  supabaseAnonKey: string;
  demoAccount: DemoAccount | null;
}
