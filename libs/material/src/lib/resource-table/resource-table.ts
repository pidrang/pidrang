import {
  Component,
  TemplateRef,
  computed,
  contentChild,
  input,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { Field } from '@pidrang/core';

@Component({
  selector: 'lib-resource-table',
  imports: [MatTableModule, NgTemplateOutlet],
  templateUrl: './resource-table.html',
  styleUrl: './resource-table.css',
})
export class ResourceTable<T extends Record<string, unknown>> {
  readonly fields = input.required<Field[]>();
  readonly data = input.required<T[]>();
  readonly actions = contentChild<TemplateRef<{ $implicit: T }>>('actions');

  protected readonly displayedColumns = computed(() => {
    const names = this.fields().map((field) => field.name);
    return this.actions() ? [...names, 'actions'] : names;
  });

  protected columnHeader(field: Field): string {
    return field.label ?? field.name;
  }
}
