import {
  Component,
  TemplateRef,
  contentChild,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Field, Sorter } from '@pidrang/core';

@Component({
  selector: 'pidrang-tailwind-resource-table',
  imports: [NgTemplateOutlet],
  templateUrl: './resource-table.html',
})
export class ResourceTable<T extends Record<string, unknown>> {
  readonly fields = input.required<Field[]>();
  readonly data = input.required<T[]>();
  readonly actions = contentChild<TemplateRef<{ $implicit: T }>>('actions');
  readonly sort = input<Sorter | null | undefined>(undefined);
  readonly sortChange = output<Sorter | null>();

  protected columnHeader(field: Field): string {
    return field.label ?? field.name;
  }

  protected isSortable(field: Field): boolean {
    return this.sort() !== undefined && field.sortable !== false;
  }

  protected ariaSort(field: Field): 'ascending' | 'descending' | 'none' | null {
    if (!this.isSortable(field)) {
      return null;
    }
    const sort = this.sort();
    if (sort?.field !== field.name) {
      return 'none';
    }
    switch (sort.order) {
      case 'asc':
        return 'ascending';
      case 'desc':
        return 'descending';
    }
  }

  protected sortIndicator(field: Field): string {
    const sort = this.sort();
    if (sort?.field !== field.name) {
      return '⇅';
    }
    switch (sort.order) {
      case 'asc':
        return '↑';
      case 'desc':
        return '↓';
    }
  }

  protected toggleSort(field: Field): void {
    const sort = this.sort();
    if (sort?.field === field.name) {
      switch (sort.order) {
        case 'asc':
          this.sortChange.emit({ field: field.name, order: 'desc' });
          return;
        case 'desc':
          this.sortChange.emit(null);
          return;
      }
    }
    this.sortChange.emit({ field: field.name, order: 'asc' });
  }
}
