import { Field } from './field';
import { ListParams } from './list-params';

export interface Resource {
  name: string;
  label?: string;
  fields?: Field[];
  defaultSorters?: ListParams['sorters'];

  list?: boolean;
  create?: boolean;
  show?: boolean;
  edit?: boolean;
  delete?: boolean;
}
