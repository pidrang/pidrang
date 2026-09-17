import { Field } from '@pidrang/core';
import { CrudAction } from './crud-action';

export interface TablePlan {
  table: string;
  fields: Field[];
  actions: CrudAction[];
  hiddenFields: string[];
}

export interface GenerationPlan {
  providerId: string;
  tables: TablePlan[];
}
