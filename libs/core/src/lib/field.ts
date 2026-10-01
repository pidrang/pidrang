export type FieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'time'
  | 'numeric';

export interface Field {
  name: string;
  label?: string;
  type: FieldType;
  hidden?: boolean;
  readOnly?: boolean;
  nullable?: boolean;
  hasDefault?: boolean;
}
