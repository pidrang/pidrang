import { PidrangErrorCategory } from '@pidrang/core';

export interface DeleteFailure {
  message: string;
  category: PidrangErrorCategory;
}
