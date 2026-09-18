import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  injectAuthProvider,
  injectAuthSession,
  injectResources,
} from '@pidrang/core';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `
    <h1 class="text-2xl font-semibold text-gray-900">Pidrang demo</h1>

    @if (session.value(); as identity) {
      <p class="mt-2 flex items-center gap-2 text-gray-700">
        Signed in as {{ identity.email ?? identity.id }}
        <button
          type="button"
          (click)="signOut()"
          class="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          Sign out
        </button>
      </p>
    } @else {
      <p class="mt-2">
        <a
          routerLink="/login"
          class="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >Sign in</a
        >
      </p>
    }

    <ul class="mt-4 flex flex-col gap-1">
      @for (resource of resources; track resource.name) {
        <li>
          <a
            [routerLink]="[resource.name]"
            class="text-blue-600 hover:underline"
            >{{ resource.label ?? resource.name }}</a
          >
        </li>
      }
    </ul>
  `,
})
export class HomePage {
  protected readonly resources = injectResources();
  protected readonly session = injectAuthSession();

  private readonly authProvider = injectAuthProvider();

  protected async signOut(): Promise<void> {
    await this.authProvider.logout();
    this.session.reload();
  }
}
