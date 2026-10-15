import { Component, TemplateRef, contentChild, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Field } from '@pidrang/core';

@Component({
  selector: 'pidrang-tailwind-resource-table',
  imports: [NgTemplateOutlet],
  templateUrl: './resource-table.html',
})
export class ResourceTable<T extends Record<string, unknown>> {
  readonly fields = input.required<Field[]>();
  readonly data = input.required<T[]>();
  readonly actions = contentChild<TemplateRef<{ $implicit: T }>>('actions');

  protected columnHeader(field: Field): string {
    return field.label ?? field.name;
  }
}
