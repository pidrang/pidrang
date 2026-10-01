import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  injectAuthProvider,
  injectAuthSession,
  injectResources,
  isResourceActionEnabled,
} from '@pidrang/core';
import { injectSignInUrl } from '@pidrang/demo-shared';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `
    <h1 class="text-2xl font-semibold text-gray-900">Pidrang demo</h1>

    @if (session.error(); as sessionError) {
      <p class="mt-2 text-red-600">
        Could not load your session: {{ sessionError.message }}
      </p>
    } @else if (session.value(); as identity) {
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
          [routerLink]="signInUrl"
          class="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >Sign in</a
        >
      </p>
    }

    <ul class="mt-4 flex flex-col gap-1">
      @for (resource of resources; track resource.name) {
        @if (isResourceActionEnabled(resource, 'list')) {
          <li>
            <a
              [routerLink]="[resource.name]"
              class="text-blue-600 hover:underline"
              >{{ resource.label ?? resource.name }}</a
            >
          </li>
        } @else if (isResourceActionEnabled(resource, 'create')) {
          <li>
            <a
              [routerLink]="[resource.name, 'create']"
              class="text-blue-600 hover:underline"
              >Create {{ resource.label ?? resource.name }}</a
            >
          </li>
        }
      }
    </ul>

    <p class="mt-4 text-gray-700">
      Compare with the same demo built on a different UI adapter:
      <a [href]="materialDemoUrl" class="text-blue-600 hover:underline"
        >Material adapter</a
      >
    </p>
  `,
})
export class HomePage {
  protected readonly signInUrl = injectSignInUrl();
  protected readonly materialDemoUrl = environment.materialDemoUrl;
  protected readonly resources = injectResources();
  protected readonly isResourceActionEnabled = isResourceActionEnabled;
  protected readonly session = injectAuthSession();

  private readonly authProvider = injectAuthProvider();

  protected async signOut(): Promise<void> {
    await this.authProvider.logout();
  }
}
