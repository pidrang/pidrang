import { CrudAction } from './crud-action';

export interface UnavailableAction {
  action: CrudAction;
  reason: string;
}
