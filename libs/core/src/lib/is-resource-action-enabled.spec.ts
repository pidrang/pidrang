import { isResourceActionEnabled } from './is-resource-action-enabled';
import { Resource } from './resource';
import { ResourceAction } from './resource-action';

const ACTIONS: ResourceAction[] = ['list', 'create', 'show', 'edit', 'delete'];

describe('isResourceActionEnabled', () => {
  it('treats omitted flags as enabled', () => {
    for (const action of ACTIONS) {
      expect(isResourceActionEnabled({ name: 'users' }, action)).toBe(true);
    }
  });

  it.each(ACTIONS)('disables only %s when it alone is false', (disabled) => {
    const resource: Resource = { name: 'users', [disabled]: false };

    for (const action of ACTIONS) {
      expect(isResourceActionEnabled(resource, action)).toBe(
        action !== disabled,
      );
    }
  });

  it('disables every action of an all-false resource', () => {
    const resource: Resource = {
      name: 'users',
      list: false,
      create: false,
      show: false,
      edit: false,
      delete: false,
    };

    for (const action of ACTIONS) {
      expect(isResourceActionEnabled(resource, action)).toBe(false);
    }
  });

  it('disables every action of an unknown resource', () => {
    for (const action of ACTIONS) {
      expect(isResourceActionEnabled(undefined, action)).toBe(false);
    }
  });
});
