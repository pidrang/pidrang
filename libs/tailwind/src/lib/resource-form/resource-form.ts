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
  selector: 'pidrang-tailwind-resource-form',
  imports: [FormField, FormRoot],
  templateUrl: './resource-form.html',
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

  protected fieldTree(name: string): SignalField<string | number | null> {
    return (this.model as Record<string, SignalField<string | number | null>>)[
      name
    ];
  }

  protected booleanFieldTree(name: string): SignalField<boolean> {
    return (this.model as Record<string, SignalField<boolean>>)[name];
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
    if (
      this.mode() !== 'create' ||
      !field.hasDefault ||
      this.isDirty(field.name)
    ) {
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
    return shouldBlockSubmit(
      this.mode(),
      this.isDirty(field.name),
      this.isInvalid(field.name),
    );
  }

  private touchBlockingFields(): void {
    for (const field of this.editableFields()) {
      if (this.blocksSubmit(field)) {
        (this.model as Record<string, SignalField<unknown>>)
          [field.name]()
          .markAsTouched();
      }
    }
  }

  private isInvalid(name: string): boolean {
    return (this.model as Record<string, SignalField<unknown>>)
      [name]()
      .invalid();
  }

  private isDirty(name: string): boolean {
    return (this.model as Record<string, SignalField<unknown>>)[name]().dirty();
  }

  private buildPayload(): Partial<T> {
    return buildResourcePayload(
      this.mode(),
      this.fields(),
      this.draft(),
      (name) => this.isDirty(name),
    ) as Partial<T>;
  }
}
