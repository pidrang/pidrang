import { Component, inject, signal } from '@angular/core';
import { injectAuthProvider, injectAuthSession } from '@pidrang/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { DEMO_ACCOUNT, DemoAccount } from '@pidrang/demo-shared';
import { injectSignIn } from './sign-in';

const TEMPLATE = `
  <mat-card>
    <mat-card-content>
      <h1>Sign in</h1>

      <form (submit)="submit($event)">
        <mat-form-field>
          <mat-label>Email</mat-label>
          <input
            #emailInput
            matInput
            type="email"
            [value]="email()"
            (input)="email.set(emailInput.value)"
          />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Password</mat-label>
          <input
            #passwordInput
            matInput
            type="password"
            [value]="password()"
            (input)="password.set(passwordInput.value)"
          />
        </mat-form-field>
        @if (error()) {
          <p role="alert">{{ error() }}</p>
        }
        @if (stalled()) {
          <p role="alert">
            No answer from the server after 30 seconds. Reload the page to try
            again.
          </p>
        } @else if (pending()) {
          <p role="status">Signing in…</p>
        }
        <button
          mat-flat-button
          color="primary"
          type="submit"
          [disabled]="pending()"
        >
          Sign in
        </button>
      </form>

      @if (session.value(); as identity) {
        <section class="signed-in" aria-labelledby="signed-in-title">
          <h2 id="signed-in-title">Signed in</h2>
          <p>
            Signed in as <strong>{{ identity.email ?? identity.id }}</strong>.
          </p>
          <button
            mat-stroked-button
            type="button"
            [disabled]="pending()"
            (click)="signOut()"
          >
            Sign out
          </button>
        </section>
      }

      @if (demoAccount; as account) {
        <section class="demo-account" aria-labelledby="demo-account-title">
          <h2 id="demo-account-title">Demo account</h2>
          <p>
            Every visitor shares this account. Its credentials cannot be
            changed.
          </p>
          <p>
            <code>{{ account.email }}</code
            ><br />
            <code>{{ account.password }}</code>
          </p>
          <button
            mat-stroked-button
            type="button"
            [disabled]="pending()"
            (click)="signInAsDemo(account)"
          >
            Sign in as the demo account
          </button>
        </section>
      }
    </mat-card-content>
  </mat-card>
`;

const STYLES = `
  :host {
    display: flex;
    justify-content: center;
    padding-block: 24px;
  }

  mat-card {
    width: 100%;
    max-width: 360px;
  }

  h1 {
    margin-top: 0;
  }

  form {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  form button {
    align-self: flex-end;
  }

  .signed-in,
  .demo-account {
    margin-top: 24px;
  }

  .signed-in h2,
  .demo-account h2 {
    margin: 0 0 8px;
    font-size: 1rem;
  }
`;

@Component({
  selector: 'app-sign-in-page',
  imports: [MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: TEMPLATE,
  styles: STYLES,
})
export class SignInPage {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly demoAccount = inject(DEMO_ACCOUNT);
  protected readonly session = injectAuthSession();

  private readonly authProvider = injectAuthProvider();
  private readonly signInState = injectSignIn();
  protected readonly pending = this.signInState.pending;
  protected readonly stalled = this.signInState.stalled;
  protected readonly error = this.signInState.error;

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    await this.signInState.signIn({
      email: this.email(),
      password: this.password(),
    });
  }

  protected async signInAsDemo(account: DemoAccount): Promise<void> {
    if (this.pending()) {
      return;
    }
    this.email.set(account.email);
    this.password.set(account.password);
    await this.signInState.signIn({
      email: account.email,
      password: account.password,
    });
  }

  protected async signOut(): Promise<void> {
    await this.authProvider.logout();
    this.session.reload();
  }
}
