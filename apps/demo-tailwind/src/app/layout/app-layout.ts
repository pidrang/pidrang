import {
  Component,
  DOCUMENT,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { injectResources, isResourceActionEnabled } from '@pidrang/core';
import {
  injectAuthSessionState,
  injectSignedInResources,
  injectSignInUrl,
  urlNeedsSignIn,
} from '@pidrang/demo-shared';

const TEMPLATE = `
  <header
    class="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-3 max-[48rem]:flex-wrap"
  >
    <button
      #menuButton
      type="button"
      class="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
      [attr.aria-expanded]="menuOpen()"
      aria-controls="app-menu"
      (click)="menuOpen.set(!menuOpen())"
    >
      Menu
    </button>
    <strong class="min-w-0 text-lg text-gray-900 max-[48rem]:truncate">{{
      appName()
    }}</strong>
    <span
      class="ml-auto text-sm text-gray-700 max-[48rem]:flex max-[48rem]:min-w-0 max-[48rem]:items-center"
    >
      @if (currentIdentity(); as identity) {
        <span class="min-w-0 max-[48rem]:truncate">{{
          identity.email ?? identity.id
        }}</span>
        <button
          type="button"
          class="ml-2 shrink-0 rounded border border-gray-300 px-3 py-1 hover:bg-gray-100"
          (click)="signOut()"
        >
          Sign out
        </button>
      } @else if (signInLink; as path) {
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
        #menu
        id="app-menu"
        class="w-56 border-r border-gray-200 bg-gray-50 p-2 max-[48rem]:absolute max-[48rem]:inset-y-0 max-[48rem]:left-0 max-[48rem]:z-10 max-[48rem]:max-w-full max-[48rem]:overflow-y-auto max-[48rem]:shadow-lg"
      >
        <a
          routerLink="/"
          routerLinkActive="bg-gray-200 font-semibold"
          [routerLinkActiveOptions]="{ exact: true }"
          (click)="closeOnNarrow()"
          class="block rounded px-3 py-2 text-sm break-words text-gray-800 hover:bg-gray-200"
          >Home</a
        >
        @for (resource of visibleResources(); track resource.name) {
          @if (isResourceActionEnabled(resource, 'list')) {
            <a
              [routerLink]="['/', resource.name]"
              routerLinkActive="bg-gray-200 font-semibold"
              (click)="closeOnNarrow()"
              class="block rounded px-3 py-2 text-sm break-words text-gray-800 hover:bg-gray-200"
              >{{ resource.label ?? resource.name }}</a
            >
          } @else if (mayWrite() && isResourceActionEnabled(resource, 'create')) {
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
  host: { '(document:click)': 'closeOnOutside($event)' },
})
export class AppLayout {
  readonly appName = input.required<string>();

  private readonly auth = injectAuthSessionState();
  private readonly router = inject(Router);
  private readonly guarded = injectSignedInResources();
  private readonly signInUrl = injectSignInUrl();
  protected readonly signInLink =
    this.auth.session === null ? null : this.signInUrl;
  protected readonly currentIdentity = computed(
    () => this.auth.session?.value() ?? null,
  );
  protected readonly mayWrite = computed(
    () => !this.auth.signedOut() && !this.auth.sessionPending(),
  );
  private readonly narrow =
    inject(DOCUMENT).defaultView?.matchMedia?.('(width < 48rem)');
  protected readonly menuOpen = signal(this.narrow?.matches !== true);
  protected readonly isResourceActionEnabled = isResourceActionEnabled;
  protected readonly resources = injectResources();
  protected readonly visibleResources = computed(() =>
    this.auth.signedOut()
      ? this.resources.filter((resource) => !this.guarded.has(resource.name))
      : this.resources,
  );

  private readonly menuButton = viewChild.required('menuButton', {
    read: ElementRef<HTMLElement>,
  });
  private readonly menu = viewChild('menu', { read: ElementRef<HTMLElement> });

  protected closeOnNarrow(): void {
    if (this.narrow?.matches) {
      this.menuOpen.set(false);
      this.menuButton().nativeElement.focus();
    }
  }

  protected closeOnOutside(event: MouseEvent): void {
    const path = event.composedPath();
    const menu = this.menu()?.nativeElement;
    if (
      this.narrow?.matches !== true ||
      !this.menuOpen() ||
      (menu !== undefined && path.includes(menu)) ||
      path.includes(this.menuButton().nativeElement)
    ) {
      return;
    }
    this.menuOpen.set(false);
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    if (
      this.signInUrl !== null &&
      urlNeedsSignIn(this.router.url, this.guarded)
    ) {
      await this.router.navigateByUrl(this.signInUrl);
    }
  }
}
