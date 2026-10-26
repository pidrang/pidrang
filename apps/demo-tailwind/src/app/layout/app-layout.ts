import { Component, DOCUMENT, inject, input, signal } from '@angular/core';
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
    class="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-3 max-[48rem]:flex-wrap"
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
    <strong class="min-w-0 truncate text-lg text-gray-900">{{
      appName()
    }}</strong>
    <span
      class="ml-auto text-sm text-gray-700 max-[48rem]:flex max-[48rem]:min-w-0 max-[48rem]:items-center"
    >
      @if (session.value(); as identity) {
        <span class="min-w-0 truncate">{{ identity.email ?? identity.id }}</span>
        <button
          type="button"
          class="ml-2 shrink-0 rounded border border-gray-300 px-3 py-1 hover:bg-gray-100"
          (click)="signOut()"
        >
          Sign out
        </button>
      } @else if (signInUrl; as path) {
        <a
          [routerLink]="path"
          class="shrink-0 rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
          >Sign in</a
        >
      }
    </span>
  </header>

  <div class="relative flex min-h-svh">
    @if (menuOpen()) {
      <nav
        id="app-menu"
        class="w-56 border-r border-gray-200 bg-gray-50 p-2 max-[48rem]:absolute max-[48rem]:inset-y-0 max-[48rem]:left-0 max-[48rem]:z-10 max-[48rem]:max-w-full max-[48rem]:shadow-lg"
      >
        <a
          routerLink="/"
          routerLinkActive="bg-gray-200 font-semibold"
          [routerLinkActiveOptions]="{ exact: true }"
          (click)="closeOnNarrow()"
          class="block rounded px-3 py-2 text-sm break-words text-gray-800 hover:bg-gray-200"
          >Home</a
        >
        @for (resource of resources; track resource.name) {
          @if (isResourceActionEnabled(resource, 'list')) {
            <a
              [routerLink]="['/', resource.name]"
              routerLinkActive="bg-gray-200 font-semibold"
              (click)="closeOnNarrow()"
              class="block rounded px-3 py-2 text-sm break-words text-gray-800 hover:bg-gray-200"
              >{{ resource.label ?? resource.name }}</a
            >
          } @else if (isResourceActionEnabled(resource, 'create')) {
            <a
              [routerLink]="['/', resource.name, 'create']"
              routerLinkActive="bg-gray-200 font-semibold"
              (click)="closeOnNarrow()"
              class="block rounded px-3 py-2 text-sm break-words text-gray-800 hover:bg-gray-200"
              >Create {{ resource.label ?? resource.name }}</a
            >
          }
        }
      </nav>
    }
    <main class="min-w-0 flex-1 p-6 max-[48rem]:overflow-x-auto">
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
  private readonly narrow =
    inject(DOCUMENT).defaultView?.matchMedia?.('(width < 48rem)');
  protected readonly menuOpen = signal(this.narrow?.matches !== true);
  protected readonly isResourceActionEnabled = isResourceActionEnabled;
  protected readonly resources = injectResources();

  private readonly authProvider = injectAuthProvider();

  protected closeOnNarrow(): void {
    if (this.narrow?.matches) {
      this.menuOpen.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    await this.authProvider.logout();
  }
}
