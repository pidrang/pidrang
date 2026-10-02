import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { injectAuthProvider } from '@pidrang/core';

@Component({
  selector: 'app-sign-in-page',
  template: `
    <h1>Sign in</h1>
    <form (submit)="submit($event)">
      <label>
        Email
        <input name="email" type="email" autocomplete="username" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>
      <button type="submit" [disabled]="pending()">Sign in</button>
    </form>
    @if (error(); as message) {
      <p role="alert">{{ message }}</p>
    }
  `,
})
export class SignInPage {
  private readonly auth = injectAuthProvider();
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.pending()) {
      return;
    }
    const data = new FormData(event.target as HTMLFormElement);
    this.pending.set(true);
    this.error.set(null);
    try {
      await this.auth.login({
        email: String(data.get('email')),
        password: String(data.get('password')),
      });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
      return;
    } finally {
      this.pending.set(false);
    }
    if (!this.destroyRef.destroyed) {
      void this.router.navigateByUrl('/');
    }
  }
}
