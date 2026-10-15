import { Field } from '@pidrang/core';
import { ExcludedColumn } from './excluded-column';
import { UnavailableAction } from './unavailable-action';

export interface TableIntrospection {
  fields: Field[];
  excludedColumns: ExcludedColumn[];
  unavailableActions: UnavailableAction[];
}
