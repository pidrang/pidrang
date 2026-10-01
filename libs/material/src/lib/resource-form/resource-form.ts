import { Component, input, linkedSignal, output } from '@angular/core';
import {
  Field as SignalField,
  FormField,
  FormRoot,
  PathKind,
  SchemaPath,
  SchemaPathRules,
  applyEach,
  form,
  pattern,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Field, FieldType } from '@pidrang/core';

type RecordPath = SchemaPath<
  Record<string, unknown>,
  SchemaPathRules.Supported,
  PathKind.Root
>;
type ChildStringPath = SchemaPath<
  string,
  SchemaPathRules.Supported,
  PathKind.Child
>;

const INPUT_TYPE_BY_FIELD_TYPE: Record<
  Exclude<FieldType, 'boolean'>,
  string
> = {
  text: 'text',
  number: 'number',
  numeric: 'text',
  date: 'date',
  timestamp: 'text',
  time: 'text',
};

const FORMAT_PATTERN_BY_FIELD_TYPE: Partial<Record<FieldType, RegExp>> = {
  timestamp:
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/,
  time: /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/,
  numeric: /^-?\d+(\.\d+)?$/,
};

const FORMAT_HINT_BY_FIELD_TYPE: Partial<Record<FieldType, string>> = {
  timestamp: 'Enter a timestamp like 2024-01-01T10:30:00 or with a Z suffix.',
  time: 'Enter a time like 10:30 or 10:30:00.',
  numeric: 'Enter a whole or decimal number, such as 42 or 19.99.',
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
  readonly pending = input(false);
  readonly save = output<T>();

  protected readonly draft = linkedSignal(() => this.value());
  protected readonly model = form(this.draft, (path) => {
    applyEach(path as unknown as RecordPath, (child) => {
      pattern(child as unknown as ChildStringPath, (ctx) =>
        this.regexForField(ctx.key()),
      );
    });
  });

  private regexForField(name: string): RegExp | undefined {
    const field = this.fields().find((candidate) => candidate.name === name);
    return field ? FORMAT_PATTERN_BY_FIELD_TYPE[field.type] : undefined;
  }

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

  protected fieldError(field: Field): string | null {
    const state = this.fieldTree(field.name)();
    if (!state.touched() || state.errors().length === 0) {
      return null;
    }
    return FORMAT_HINT_BY_FIELD_TYPE[field.type] ?? 'This value is not valid.';
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.pending() || this.model().invalid()) {
      return;
    }
    this.save.emit(this.buildPayload());
  }

  private buildPayload(): T {
    const draft = this.draft();
    const entries = this.fields()
      .filter(
        (field) => !field.hasDefault || this.fieldTree(field.name)().dirty(),
      )
      .map((field) => [field.name, draft[field.name]] as const);
    return Object.fromEntries(entries) as T;
  }
}
