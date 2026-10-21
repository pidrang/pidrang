import { DemoAccount } from './demo-account';

export interface DemoEnvironment {
  supabaseUrl: string;
  supabasePublishableKey: string;
  demoAccount: DemoAccount | null;
}
