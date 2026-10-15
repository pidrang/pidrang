import { Field, FieldType } from '@pidrang/core';

export interface UnsupportedColumnType {
  unsupported: string;
}

export interface IntrospectedColumn extends Omit<Field, 'type'> {
  type: FieldType | UnsupportedColumnType;
}
