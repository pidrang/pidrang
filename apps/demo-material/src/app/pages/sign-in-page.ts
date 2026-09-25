import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { injectAuthProvider } from '@pidrang/core';
import { DEMO_ACCOUNT, DemoAccount } from '../demo-account';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-sign-in-page',
  imports: [MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-card>
      <mat-card-content>
        <h1>Sign in</h1>

        <form>
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
            <p>{{ error() }}</p>
          }
          <button
            mat-flat-button
            color="primary"
            type="button"
            (click)="submit()"
          >
            Sign in
          </button>
        </form>

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
              (click)="signInAsDemo(account)"
            >
              Sign in as the demo account
            </button>
          </section>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
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

    .demo-account {
      margin-top: 24px;
    }

    .demo-account h2 {
      margin: 0 0 8px;
      font-size: 1rem;
    }
  `,
})
export class SignInPage {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly demoAccount = inject(DEMO_ACCOUNT);

  private readonly authProvider = injectAuthProvider();
  private readonly router = inject(Router);

  protected async signInAsDemo(account: DemoAccount): Promise<void> {
    this.email.set(account.email);
    this.password.set(account.password);
    await this.submit();
  }

  protected async submit(): Promise<void> {
    try {
      await this.authProvider.login({
        email: this.email(),
        password: this.password(),
      });
      await this.router.navigate(['/']);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
