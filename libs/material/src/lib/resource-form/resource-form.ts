import { Component, input, linkedSignal, output } from '@angular/core';
import {
  Field as SignalField,
  FormField,
  FormRoot,
  form,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Field, FieldType } from '@pidrang/core';

const INPUT_TYPE_BY_FIELD_TYPE: Record<
  Exclude<FieldType, 'boolean'>,
  string
> = {
  text: 'text',
  number: 'number',
  date: 'date',
};

@Component({
  selector: 'lib-resource-form',
  imports: [
    FormField,
    FormRoot,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
  ],
  templateUrl: './resource-form.html',
  styleUrl: './resource-form.css',
})
export class ResourceForm<T extends Record<string, unknown>> {
  readonly fields = input.required<Field[]>();
  readonly value = input.required<T>();
  readonly save = output<T>();

  protected readonly draft = linkedSignal(() => this.value());
  protected readonly model = form(this.draft);

  protected fieldTree(
    name: string,
  ): SignalField<string | number | boolean | Date | null> {
    return (
      this.model as Record<
        string,
        SignalField<string | number | boolean | Date | null>
      >
    )[name];
  }

  protected fieldLabel(field: Field): string {
    return field.label ?? field.name;
  }

  protected inputType(field: Field): string {
    return INPUT_TYPE_BY_FIELD_TYPE[
      field.type as Exclude<FieldType, 'boolean'>
    ];
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.save.emit(this.draft());
  }
}
