import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  injectAuthProvider,
  injectAuthSession,
  injectResources,
} from '@pidrang/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, MatButtonModule],
  template: `
    <h1>Pidrang demo</h1>

    @if (session.value(); as identity) {
      <p>
        Signed in as {{ identity.email ?? identity.id }}
        <button mat-stroked-button type="button" (click)="signOut()">
          Sign out
        </button>
      </p>
    } @else {
      <p><a mat-flat-button color="primary" routerLink="/login">Sign in</a></p>
    }

    <ul>
      @for (resource of resources; track resource.name) {
        <li>
          <a mat-button [routerLink]="[resource.name]">{{
            resource.label ?? resource.name
          }}</a>
        </li>
      }
    </ul>

    <p>
      Compare with the same demo built on a different UI adapter:
      <a mat-button href="http://localhost:4201">Tailwind adapter</a>
    </p>
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
