import { Resource } from './resource';
import { ResourceAction } from './resource-action';

export function isResourceActionEnabled(
  resource: Resource | undefined,
  action: ResourceAction,
): boolean {
  return resource !== undefined && resource[action] !== false;
}
