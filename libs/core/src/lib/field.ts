export type FieldType = 'text' | 'number' | 'boolean' | 'date';

export interface Field {
  name: string;
  label?: string;
  type: FieldType;
  hidden?: boolean;
}
