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
  selector: 'pidrang-material-resource-table',
  imports: [MatTableModule, NgTemplateOutlet],
  templateUrl: './resource-table.html',
  styleUrl: './resource-table.css',
})
export class ResourceTable<T extends Record<string, unknown>> {
  readonly fields = input.required<Field[]>();
  readonly data = input.required<T[]>();
  readonly actions = contentChild<TemplateRef<{ $implicit: T }>>('actions');

  protected readonly actionsColumn = 'actions';

  protected readonly displayedColumns = computed(() => {
    const columns = this.fields().map((_, index) => this.fieldColumn(index));
    return this.actions() ? [...columns, this.actionsColumn] : columns;
  });

  protected fieldColumn(index: number): string {
    return `field-${index}`;
  }

  protected columnHeader(field: Field): string {
    return field.label ?? field.name;
  }
}
