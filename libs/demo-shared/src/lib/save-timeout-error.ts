export class SaveTimeoutError extends Error {
  constructor(seconds: number) {
    super(
      `No answer from the server after ${seconds} seconds. The save may still be applied, so the form stays disabled until the server answers; reload the page to stop waiting.`,
    );
    this.name = 'SaveTimeoutError';
  }
}
