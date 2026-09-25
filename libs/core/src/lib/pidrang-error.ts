import { PidrangErrorCategory } from './pidrang-error-category';
import { PidrangErrorOptions } from './pidrang-error-options';

export class PidrangError extends Error {
  readonly category: PidrangErrorCategory;
  readonly code: string | undefined;
  readonly status: number | undefined;
  readonly cause: unknown;

  constructor(message: string, options: PidrangErrorOptions) {
    super(message);
    this.name = 'PidrangError';
    this.category = options.category;
    this.code = options.code;
    this.status = options.status;
    this.cause = options.cause;
  }
}
