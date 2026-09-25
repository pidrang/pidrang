import { PidrangErrorCategory } from './pidrang-error-category';

export interface PidrangErrorOptions {
  category: PidrangErrorCategory;
  code?: string;
  status?: number;
  cause?: unknown;
}
