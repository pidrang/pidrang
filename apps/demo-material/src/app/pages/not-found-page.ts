import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, MatButtonModule],
  template: `
    <h1>Page not available</h1>
    <p>This resource does not exist, or this action is disabled for it.</p>
    <a mat-button routerLink="/">Back to home</a>
  `,
})
export class NotFoundPage {}
