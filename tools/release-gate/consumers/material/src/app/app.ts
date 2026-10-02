import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { injectAuthProvider, injectAuthSession } from '@pidrang/core';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  template: `
    <nav>
      <a routerLink="/">Home</a>
      @if (session.value(); as identity) {
        <span data-testid="identity">{{ identity.email }}</span>
        <button type="button" (click)="signOut()">Sign out</button>
      } @else {
        <a routerLink="/sign-in">Sign in</a>
      }
    </nav>
    <router-outlet />
  `,
})
export class App {
  private readonly auth = injectAuthProvider();
  protected readonly session = injectAuthSession();

  protected async signOut(): Promise<void> {
    await this.auth.logout();
  }
}
