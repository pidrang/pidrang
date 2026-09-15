import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { injectAuthProvider } from '@pidrang/core';

@Component({
  selector: 'app-sign-in-page',
  template: `
    <h1>Sign in</h1>

    <input
      type="email"
      placeholder="Email"
      [value]="email()"
      (input)="email.set($any($event.target).value)"
    />
    <input
      type="password"
      placeholder="Password"
      [value]="password()"
      (input)="password.set($any($event.target).value)"
    />
    @if (error()) {
      <p>{{ error() }}</p>
    }
    <button type="button" (click)="submit()">Sign in</button>
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
      await this.authProvider.login({ email: this.email(), password: this.password() });
      await this.router.navigate(['/']);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
