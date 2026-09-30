import {
  CONFORMANCE_ROWS,
  describeDataProviderConformance,
} from '@pidrang/provider-conformance';
import { createClient } from '@supabase/supabase-js';

import { SupabaseDataProvider } from './supabase-data-provider';

const url = process.env['PIDRANG_CONFORMANCE_SUPABASE_URL'];
const key = process.env['PIDRANG_CONFORMANCE_SUPABASE_KEY'];
const TABLE = 'conformance_items';

if (url && key) {
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(
      `The conformance suite deletes every row of ${TABLE}: point PIDRANG_CONFORMANCE_SUPABASE_URL to a local stack, not ${host}`,
    );
  }
  const client = createClient(url, key, { auth: { persistSession: false } });
  const reset = async (): Promise<void> => {
    const { error } = await client.from(TABLE).delete().not('id', 'is', null);
    if (error) {
      throw new Error(error.message);
    }
  };

  describeDataProviderConformance('supabase', {
    resource: TABLE,
    setup: async () => {
      await reset();
      const { error } = await client.from(TABLE).insert([...CONFORMANCE_ROWS]);
      if (error) {
        throw new Error(error.message);
      }
      return new SupabaseDataProvider(client);
    },
    teardown: reset,
  });
} else {
  describe.skip('supabase data provider conformance', () => {
    it('needs PIDRANG_CONFORMANCE_SUPABASE_URL and PIDRANG_CONFORMANCE_SUPABASE_KEY', () => {
      expect(url && key).toBeTruthy();
    });
  });
}
