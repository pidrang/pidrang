import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectResources } from '@pidrang/core';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `
    <h1>Release gate consumer</h1>
    <ul>
      @for (resource of resources; track resource.name) {
        <li>
          <a [routerLink]="['/', resource.name]">{{ resource.name }}</a>
        </li>
      }
    </ul>
  `,
})
export class HomePage {
  protected readonly resources = injectResources();
}
