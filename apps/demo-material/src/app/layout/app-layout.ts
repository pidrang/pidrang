import {
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  injectAuthProvider,
  injectAuthSession,
  injectResources,
  isResourceActionEnabled,
} from '@pidrang/core';
import { injectSignInUrl } from '@pidrang/demo-shared';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';

const TEMPLATE = `
  <div class="layout">
    @if (menuOpen()) {
      <mat-nav-list #menu id="app-menu" class="menu">
        <a
          mat-list-item
          routerLink="/"
          routerLinkActive
          #homeLink="routerLinkActive"
          [activated]="homeLink.isActive"
          [routerLinkActiveOptions]="{ exact: true }"
          (click)="closeOnNarrow()"
          >Home</a
        >
        @for (resource of resources; track resource.name) {
          @if (isResourceActionEnabled(resource, 'list')) {
            <a
              mat-list-item
              [routerLink]="['/', resource.name]"
              routerLinkActive
              #listLink="routerLinkActive"
              [activated]="listLink.isActive"
              (click)="closeOnNarrow()"
              >{{ resource.label ?? resource.name }}</a
            >
          } @else if (isResourceActionEnabled(resource, 'create')) {
            <a
              mat-list-item
              [routerLink]="['/', resource.name, 'create']"
              (click)="closeOnNarrow()"
              >Create {{ resource.label ?? resource.name }}</a
            >
          }
        }
      </mat-nav-list>
    }
    <div class="main">
      <mat-toolbar>
        <button
          #menuButton
          mat-button
          type="button"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="app-menu"
          (click)="menuOpen.set(!menuOpen())"
        >
          Menu
        </button>
        <span class="app-name">{{ appName() }}</span>
        <span class="spacer"></span>
        @if (session.value(); as identity) {
          <span class="identity">{{ identity.email ?? identity.id }}</span>
          <button mat-stroked-button type="button" (click)="signOut()">
            Sign out
          </button>
        } @else if (signInUrl; as path) {
          <a mat-flat-button color="primary" [routerLink]="path">Sign in</a>
        }
      </mat-toolbar>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  </div>
`;

const STYLES = `
  .layout {
    display: flex;
    height: 100svh;
  }

  .menu {
    width: 14rem;
    flex-shrink: 0;
    border-right: 1px solid #e0e0e0;
    overflow-y: auto;
  }

  .main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
  }

  .spacer {
    flex: 1;
  }

  .identity {
    margin-right: 0.5rem;
  }

  .content {
    padding: 1.5rem;
  }

  @media (width < 48rem) {
    .app-name,
    .identity {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .layout {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      grid-template-columns: minmax(0, 1fr);
    }

    .main {
      display: contents;
    }

    mat-toolbar {
      grid-row: 1;
      grid-column: 1;
    }

    .content {
      grid-row: 2;
      grid-column: 1;
      min-width: 0;
      overflow: auto;
    }

    .menu {
      grid-row: 2;
      grid-column: 1;
      z-index: 1;
      justify-self: start;
      box-sizing: border-box;
      width: min(14rem, 100%);
      background: var(--mat-sys-surface, Canvas);
      box-shadow: 0 0.5rem 1rem rgb(0 0 0 / 0.2);
    }
  }
`;

@Component({
  selector: 'app-layout',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatListModule,
    MatToolbarModule,
  ],
  template: TEMPLATE,
  styles: STYLES,
  host: { '(document:click)': 'closeOnOutside($event)' },
})
export class AppLayout {
  readonly appName = input.required<string>();

  protected readonly session = injectAuthSession();
  protected readonly signInUrl = injectSignInUrl();
  private readonly narrow =
    inject(DOCUMENT).defaultView?.matchMedia?.('(width < 48rem)');
  protected readonly menuOpen = signal(this.narrow?.matches !== true);
  protected readonly resources = injectResources();
  protected readonly isResourceActionEnabled = isResourceActionEnabled;

  private readonly authProvider = injectAuthProvider();

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
    await this.authProvider.logout();
  }
}
