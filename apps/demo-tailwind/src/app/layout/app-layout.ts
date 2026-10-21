import { Component, input, linkedSignal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  injectAuthProvider,
  injectAuthSession,
  injectResources,
  isResourceActionEnabled,
} from '@pidrang/core';
import { injectSignInUrl } from '@pidrang/demo-shared';

const TEMPLATE = `
  <header
    class="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-3"
  >
    <button
      type="button"
      class="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
      [attr.aria-expanded]="menuOpen()"
      aria-controls="app-menu"
      (click)="menuOpen.set(!menuOpen())"
    >
      Menu
    </button>
    <strong class="text-lg text-gray-900">{{ appName() }}</strong>
    <span class="ml-auto text-sm text-gray-700">
      @if (session.value(); as identity) {
        {{ identity.email ?? identity.id }}
        <button
          type="button"
          class="ml-2 rounded border border-gray-300 px-3 py-1 hover:bg-gray-100"
          (click)="signOut()"
        >
          Sign out
        </button>
      } @else if (signInUrl; as path) {
        <a
          [routerLink]="path"
          class="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
          >Sign in</a
        >
      }
    </span>
  </header>

  <div class="flex min-h-svh">
    @if (menuOpen()) {
      <nav id="app-menu" class="w-56 border-r border-gray-200 bg-gray-50 p-2">
        <a
          routerLink="/"
          routerLinkActive="bg-gray-200 font-semibold"
          [routerLinkActiveOptions]="{ exact: true }"
          class="block rounded px-3 py-2 text-sm text-gray-800 hover:bg-gray-200"
          >Home</a
        >
        @for (resource of resources; track resource.name) {
          @if (isResourceActionEnabled(resource, 'list')) {
            <a
              [routerLink]="['/', resource.name]"
              routerLinkActive="bg-gray-200 font-semibold"
              class="block rounded px-3 py-2 text-sm text-gray-800 hover:bg-gray-200"
              >{{ resource.label ?? resource.name }}</a
            >
          } @else if (isResourceActionEnabled(resource, 'create')) {
            <a
              [routerLink]="['/', resource.name, 'create']"
              routerLinkActive="bg-gray-200 font-semibold"
              class="block rounded px-3 py-2 text-sm text-gray-800 hover:bg-gray-200"
              >Create {{ resource.label ?? resource.name }}</a
            >
          }
        }
      </nav>
    }
    <main class="min-w-0 flex-1 p-6">
      <router-outlet />
    </main>
  </div>
`;

@Component({
  selector: 'app-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: TEMPLATE,
})
export class AppLayout {
  readonly appName = input.required<string>();

  protected readonly session = injectAuthSession();
  protected readonly signInUrl = injectSignInUrl();
  protected readonly menuOpen = linkedSignal(() => true);
  protected readonly isResourceActionEnabled = isResourceActionEnabled;
  protected readonly resources = injectResources();

  private readonly authProvider = injectAuthProvider();

  protected async signOut(): Promise<void> {
    await this.authProvider.logout();
  }
}
