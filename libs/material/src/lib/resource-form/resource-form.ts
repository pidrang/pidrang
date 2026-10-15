import { Component, input, linkedSignal, output } from '@angular/core';
import {
  ChildFieldContext,
  Field as SignalField,
  FormField,
  FormRoot,
  PathKind,
  SchemaPath,
  SchemaPathRules,
  applyEach,
  form,
  pattern,
  required,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  Field,
  ResourceFormMode,
  buildResourcePayload,
  fieldRequiresValueWhenEmpty,
  formatHintForField,
  formatPatternForField,
  inputTypeForField,
  normalizeResourceValue,
  shouldBlockSubmit,
} from '@pidrang/core';

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
type ChildPath = SchemaPath<unknown, SchemaPathRules.Supported, PathKind.Child>;

@Component({
  selector: 'pidrang-material-resource-form',
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
  readonly mode = input.required<ResourceFormMode>();
  readonly fields = input.required<Field[]>();
  readonly value = input.required<T>();
  readonly pending = input(false);
  readonly save = output<Partial<T>>();

  protected readonly draft = linkedSignal(() =>
    normalizeResourceValue(this.fields(), this.value()),
  );
  protected readonly model = form(this.draft, (path) => {
    applyEach(path as unknown as RecordPath, (child) => {
      pattern(child as unknown as ChildStringPath, (ctx) =>
        this.regexForField(ctx.key()),
      );
      required(child as unknown as ChildPath, {
        when: (ctx) => this.isRequiredWhenEmpty(ctx),
      });
    });
  });

  protected editableFields(): Field[] {
    return this.fields().filter((field) => !field.readOnly);
  }

  private fieldByName(name: string): Field | undefined {
    return this.fields().find((candidate) => candidate.name === name);
  }

  private regexForField(name: string): RegExp | undefined {
    const field = this.fieldByName(name);
    return field ? formatPatternForField(field) : undefined;
  }

  private isRequiredWhenEmpty(ctx: ChildFieldContext<unknown>): boolean {
    const field = this.fieldByName(ctx.key());
    if (!field || !fieldRequiresValueWhenEmpty(field)) {
      return false;
    }
    return !field.hasDefault || ctx.state.dirty();
  }

  protected fieldTree(
    name: string,
  ): SignalField<string | number | boolean | null> {
    return (
      this.model as Record<
        string,
        SignalField<string | number | boolean | null>
      >
    )[name];
  }

  protected fieldLabel(field: Field): string {
    return field.label ?? field.name;
  }

  protected inputType(field: Field): string {
    return inputTypeForField(field);
  }

  protected fieldError(field: Field): string | null {
    const state = this.fieldTree(field.name)();
    if ((!state.dirty() && !state.touched()) || state.errors().length === 0) {
      return null;
    }
    return formatHintForField(field);
  }

  protected fieldHint(field: Field): string | null {
    if (!field.hasDefault || this.fieldTree(field.name)().dirty()) {
      return null;
    }
    return 'Leave unchanged to use the database default.';
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.pending()) {
      return;
    }
    if (this.hasBlockingError()) {
      this.touchBlockingFields();
      return;
    }
    const payload = this.buildPayload();
    if (this.mode() === 'edit' && Object.keys(payload).length === 0) {
      return;
    }
    this.save.emit(payload);
  }

  private hasBlockingError(): boolean {
    return this.editableFields().some((field) => this.blocksSubmit(field));
  }

  private blocksSubmit(field: Field): boolean {
    const state = this.fieldTree(field.name)();
    return shouldBlockSubmit(this.mode(), state.dirty(), state.invalid());
  }

  private touchBlockingFields(): void {
    for (const field of this.editableFields()) {
      if (this.blocksSubmit(field)) {
        this.fieldTree(field.name)().markAsTouched();
      }
    }
  }

  private buildPayload(): Partial<T> {
    return buildResourcePayload(
      this.mode(),
      this.fields(),
      this.draft(),
      (name) => this.fieldTree(name)().dirty(),
    ) as Partial<T>;
  }
}
