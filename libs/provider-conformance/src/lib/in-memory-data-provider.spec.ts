import { CONFORMANCE_ROWS } from './conformance-rows';
import { describeDataProviderConformance } from './describe-data-provider-conformance';
import { createInMemoryDataProvider } from './in-memory-data-provider';

describeDataProviderConformance('in-memory', {
  resource: 'items',
  setup: async () => createInMemoryDataProvider({ items: CONFORMANCE_ROWS }),
});
