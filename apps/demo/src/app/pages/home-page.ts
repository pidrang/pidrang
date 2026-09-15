import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectAuthProvider, injectAuthSession, injectResources } from '@pidrang/core';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `
    <h1>Pidrang demo</h1>

    @if (session.value(); as identity) {
      <p>
        Signed in as {{ identity.email ?? identity.id }}
        <button type="button" (click)="signOut()">Sign out</button>
      </p>
    } @else {
      <p><a routerLink="/login">Sign in</a></p>
    }

    <ul>
      @for (resource of resources; track resource.name) {
        <li><a [routerLink]="[resource.name]">{{ resource.label ?? resource.name }}</a></li>
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
