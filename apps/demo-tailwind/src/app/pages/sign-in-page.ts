import { Component, inject, signal } from '@angular/core';
import { injectAuthProvider, injectAuthSession } from '@pidrang/core';
import { DEMO_ACCOUNT, DemoAccount, injectSignIn } from '@pidrang/demo-shared';

const TEMPLATE = `
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
          <p role="alert" class="text-red-600">{{ error() }}</p>
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

      @if (session.value(); as identity) {
        <section
          class="mt-6 border-t border-gray-200 pt-4"
          aria-labelledby="signed-in-title"
        >
          <h2 id="signed-in-title" class="text-base font-semibold text-gray-900">
            Signed in
          </h2>
          <p class="mt-1 text-sm text-gray-700">
            Signed in as <strong>{{ identity.email ?? identity.id }}</strong>.
          </p>
          <button
            type="button"
            [disabled]="pending()"
            (click)="signOut()"
            class="mt-2 rounded border border-gray-300 px-4 py-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sign out
          </button>
        </section>
      }

      @if (demoAccount; as account) {
        <section
          class="mt-6 border-t border-gray-200 pt-4"
          aria-labelledby="demo-account-title"
        >
          <h2 id="demo-account-title" class="text-base font-semibold text-gray-900">
            Demo account
          </h2>
          <p class="mt-1 text-sm text-gray-700">
            Every visitor shares this account. Its credentials cannot be
            changed.
          </p>
          <p class="mt-1 text-sm text-gray-700">
            <code>{{ account.email }}</code
            ><br />
            <code>{{ account.password }}</code>
          </p>
          <button
            type="button"
            [disabled]="pending()"
            (click)="signInAsDemo(account)"
            class="mt-2 rounded border border-gray-300 px-4 py-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sign in as the demo account
          </button>
        </section>
      }
    </div>
  </div>
`;

@Component({
  selector: 'app-sign-in-page',
  template: TEMPLATE,
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
