import { Component, computed, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { Field } from '@pidrang/core';

@Component({
  selector: 'lib-resource-table',
  imports: [MatTableModule],
  templateUrl: './resource-table.html',
  styleUrl: './resource-table.css',
})
export class ResourceTable<T extends Record<string, unknown>> {
  readonly fields = input.required<Field[]>();
  readonly data = input.required<T[]>();

  protected readonly displayedColumns = computed(() =>
    this.fields().map((field) => field.name),
  );

  protected columnHeader(field: Field): string {
    return field.label ?? field.name;
  }
}
