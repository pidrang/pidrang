import { Field } from './field';

export interface Resource {
  name: string;
  label?: string;
  fields?: Field[];

  list?: boolean;
  create?: boolean;
  show?: boolean;
  edit?: boolean;
  delete?: boolean;
}
