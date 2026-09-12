export interface Resource {
  name: string;
  label?: string;

  list?: boolean;
  create?: boolean;
  show?: boolean;
  edit?: boolean;
  delete?: boolean;
}
