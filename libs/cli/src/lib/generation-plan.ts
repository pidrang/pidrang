import { Field } from '@pidrang/core';
import { AppSetup } from './app-setup';
import { CrudAction } from './crud-action';
import { AppLayoutChoice } from './init-plan';

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

export interface InitResult extends GenerationPlan {
  setup: AppSetup;
  layout: AppLayoutChoice;
  signIn: boolean;
}
