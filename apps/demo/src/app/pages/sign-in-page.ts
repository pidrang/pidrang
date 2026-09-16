import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { injectAuthProvider } from '@pidrang/core';
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
              matInput
              type="email"
              [value]="email()"
              (input)="email.set($any($event.target).value)"
            />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Password</mat-label>
            <input
              matInput
              type="password"
              [value]="password()"
              (input)="password.set($any($event.target).value)"
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

    button {
      align-self: flex-end;
    }
  `,
})
export class SignInPage {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal<string | null>(null);

  private readonly authProvider = injectAuthProvider();
  private readonly router = inject(Router);

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
