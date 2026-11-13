import {
  Component,
  TemplateRef,
  computed,
  contentChild,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Field, Sorter } from '@pidrang/core';

@Component({
  selector: 'pidrang-material-resource-table',
  imports: [MatTableModule, MatSortModule, NgTemplateOutlet],
  templateUrl: './resource-table.html',
  styleUrl: './resource-table.css',
})
export class ResourceTable<T extends Record<string, unknown>> {
  readonly fields = input.required<Field[]>();
  readonly data = input.required<T[]>();
  readonly actions = contentChild<TemplateRef<{ $implicit: T }>>('actions');
  readonly sort = input<Sorter | null | undefined>(undefined);
  readonly sortChange = output<Sorter | null>();

  protected readonly actionsColumn = 'actions';

  protected readonly displayedColumns = computed(() => {
    const columns = this.fields().map((_, index) => this.fieldColumn(index));
    return this.actions() ? [...columns, this.actionsColumn] : columns;
  });

  protected readonly sortActive = computed(() => this.sort()?.field ?? '');
  protected readonly sortDirection = computed(
    (): SortDirection => this.sort()?.order ?? '',
  );

  protected fieldColumn(index: number): string {
    return `field-${index}`;
  }

  protected columnHeader(field: Field): string {
    return field.label ?? field.name;
  }

  protected isSortable(field: Field): boolean {
    return this.sort() !== undefined && field.sortable !== false;
  }

  protected changeSort(event: Sort): void {
    switch (event.direction) {
      case 'asc':
      case 'desc':
        this.sortChange.emit({ field: event.active, order: event.direction });
        return;
      case '':
        this.sortChange.emit(null);
        return;
    }
  }
}
