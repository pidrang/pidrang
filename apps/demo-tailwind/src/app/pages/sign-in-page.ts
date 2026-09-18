import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { injectAuthProvider } from '@pidrang/core';

@Component({
  selector: 'app-sign-in-page',
  template: `
    <div class="flex justify-center py-6">
      <div class="w-full max-w-sm rounded border border-gray-200 p-6">
        <h1 class="text-xl font-semibold text-gray-900">Sign in</h1>

        <form class="mt-4 flex flex-col items-stretch gap-2">
          <label class="flex flex-col gap-1 text-sm text-gray-700">
            Email
            <input
              type="email"
              [value]="email()"
              (input)="email.set($any($event.target).value)"
              class="rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm text-gray-700">
            Password
            <input
              type="password"
              [value]="password()"
              (input)="password.set($any($event.target).value)"
              class="rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
          </label>
          @if (error()) {
            <p class="text-red-600">{{ error() }}</p>
          }
          <button
            type="button"
            (click)="submit()"
            class="self-end rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
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
