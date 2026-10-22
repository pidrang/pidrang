export const TAILWIND_SIGN_IN_PAGE = `import { Component, inject, signal } from '@angular/core';
import { injectAuthProvider, injectAuthSession } from '@pidrang/core';

import { injectSignIn } from '../pidrang/index';

const TEMPLATE = "<div class=\\"flex justify-center py-6\\">\n  <div class=\\"w-full max-w-sm rounded border border-gray-200 p-6\\">\n    <h1 class=\\"text-xl font-semibold text-gray-900\\">Sign in</h1>\n\n    <form\n      class=\\"mt-4 flex flex-col items-stretch gap-2\\"\n      (submit)=\\"submit($event)\\"\n    >\n      <label class=\\"flex flex-col gap-1 text-sm text-gray-700\\">\n        Email\n        <input\n          #emailInput\n          type=\\"email\\"\n          [value]=\\"email()\\"\n          (input)=\\"email.set(emailInput.value)\\"\n          class=\\"rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none\\"\n        />\n      </label>\n      <label class=\\"flex flex-col gap-1 text-sm text-gray-700\\">\n        Password\n        <input\n          #passwordInput\n          type=\\"password\\"\n          [value]=\\"password()\\"\n          (input)=\\"password.set(passwordInput.value)\\"\n          class=\\"rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none\\"\n        />\n      </label>\n      @if (error()) {\n        <p role=\\"alert\\" class=\\"text-red-600\\">{{ error() }}</p>\n      }\n      @if (stalled()) {\n        <p role=\\"alert\\" class=\\"text-red-600\\">\n          No answer from the server after 30 seconds. Reload the page to try\n          again.\n        </p>\n      } @else if (pending()) {\n        <p role=\\"status\\" class=\\"text-gray-500\\">Signing in…</p>\n      }\n      <button\n        type=\\"submit\\"\n        [disabled]=\\"pending()\\"\n        class=\\"self-end rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60\\"\n      >\n        Sign in\n      </button>\n    </form>\n\n    @if (session.value(); as identity) {\n      <section\n        class=\\"mt-6 border-t border-gray-200 pt-4\\"\n        aria-labelledby=\\"signed-in-title\\"\n      >\n        <h2 id=\\"signed-in-title\\" class=\\"text-base font-semibold text-gray-900\\">\n          Signed in\n        </h2>\n        <p class=\\"mt-1 text-sm text-gray-700\\">\n          Signed in as <strong>{{ identity.email ?? identity.id }}</strong>.\n        </p>\n        <button\n          type=\\"button\\"\n          [disabled]=\\"pending()\\"\n          (click)=\\"signOut()\\"\n          class=\\"mt-2 rounded border border-gray-300 px-4 py-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60\\"\n        >\n          Sign out\n        </button>\n      </section>\n    }\n\n  </div>\n</div>";

@Component({
  selector: 'app-sign-in-page',
  template: TEMPLATE,
})
export class SignInPage {
  protected readonly email = signal('');
  protected readonly password = signal('');
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

  protected async signOut(): Promise<void> {
    await this.authProvider.logout();
    this.session.reload();
  }
}
`;

export function tailwindSignInPage(): string {
  return TAILWIND_SIGN_IN_PAGE;
}
