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
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, MatButtonModule],
  template: `
    <h1>Pidrang demo</h1>

    @if (session.error(); as sessionError) {
      <p>Could not load your session: {{ sessionError.message }}</p>
    } @else if (session.value(); as identity) {
      <p>
        Signed in as {{ identity.email ?? identity.id }}
        <button mat-stroked-button type="button" (click)="signOut()">
          Sign out
        </button>
      </p>
    } @else if (signInUrl; as path) {
      <p>
        <a mat-flat-button color="primary" [routerLink]="path">Sign in</a>
      </p>
    }

    <ul>
      @for (resource of resources; track resource.name) {
        @if (isResourceActionEnabled(resource, 'list')) {
          <li>
            <a mat-button [routerLink]="[resource.name]">{{
              resource.label ?? resource.name
            }}</a>
          </li>
        } @else if (isResourceActionEnabled(resource, 'create')) {
          <li>
            <a mat-button [routerLink]="[resource.name, 'create']"
              >Create {{ resource.label ?? resource.name }}</a
            >
          </li>
        }
      }
    </ul>

    <p>
      Compare with the same demo built on a different UI adapter:
      <a mat-button [href]="tailwindDemoUrl">Tailwind adapter</a>
    </p>
  `,
})
export class HomePage {
  protected readonly signInUrl = injectSignInUrl();
  protected readonly tailwindDemoUrl = environment.tailwindDemoUrl;
  protected readonly resources = injectResources();
  protected readonly isResourceActionEnabled = isResourceActionEnabled;
  protected readonly session = injectAuthSession();

  private readonly authProvider = injectAuthProvider();

  protected async signOut(): Promise<void> {
    await this.authProvider.logout();
  }
}
