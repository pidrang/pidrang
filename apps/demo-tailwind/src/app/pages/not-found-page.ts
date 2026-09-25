import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <h1 class="text-2xl font-semibold text-gray-900">Page not available</h1>
    <p class="mt-2 text-gray-700">
      This resource does not exist, or this action is disabled for it.
    </p>
    <a routerLink="/" class="mt-2 inline-block text-blue-600 hover:underline"
      >Back to home</a
    >
  `,
})
export class NotFoundPage {}
