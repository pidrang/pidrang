import { Component, inject, signal } from '@angular/core';
import { DEMO_ACCOUNT, DemoAccount, injectSignIn } from '@pidrang/demo-shared';

@Component({
  selector: 'app-sign-in-page',
  template: `
    <div class="flex justify-center py-6">
      <div class="w-full max-w-sm rounded border border-gray-200 p-6">
        <h1 class="text-xl font-semibold text-gray-900">Sign in</h1>

        <form
          class="mt-4 flex flex-col items-stretch gap-2"
          (submit)="submit($event)"
        >
          <label class="flex flex-col gap-1 text-sm text-gray-700">
            Email
            <input
              #emailInput
              type="email"
              [value]="email()"
              (input)="email.set(emailInput.value)"
              class="rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm text-gray-700">
            Password
            <input
              #passwordInput
              type="password"
              [value]="password()"
              (input)="password.set(passwordInput.value)"
              class="rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
          </label>
          @if (error()) {
            <p class="text-red-600">{{ error() }}</p>
          }
          @if (stalled()) {
            <p role="alert" class="text-red-600">
              No answer from the server after 30 seconds. Reload the page to try
              again.
            </p>
          } @else if (pending()) {
            <p role="status" class="text-gray-500">Signing in…</p>
          }
          <button
            type="submit"
            [disabled]="pending()"
            class="self-end rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sign in
          </button>
        </form>

        @if (demoAccount; as account) {
          <section
            class="mt-6 border-t border-gray-200 pt-4"
            aria-labelledby="demo-account-title"
          >
            <h2
              id="demo-account-title"
              class="text-base font-semibold text-gray-900"
            >
              Demo account
            </h2>
            <p class="mt-1 text-sm text-gray-700">
              Every visitor shares this account. Its credentials cannot be
              changed.
            </p>
            <p class="mt-2 font-mono text-sm text-gray-900">
              {{ account.email }}<br />
              {{ account.password }}
            </p>
            <button
              type="button"
              class="mt-3 rounded border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              [disabled]="pending()"
              (click)="signInAsDemo(account)"
            >
              Sign in as the demo account
            </button>
          </section>
        }
      </div>
    </div>
  `,
})
export class SignInPage {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly demoAccount = inject(DEMO_ACCOUNT);

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
}
