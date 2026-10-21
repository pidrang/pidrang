import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SUPPORTED_NODE,
  nodeVersionProblem,
  supportsNode,
} from './node-version';

describe('supportsNode', () => {
  it('matches the engines field of the package', () => {
    const manifest = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
    ) as { engines: { node: string } };

    expect(manifest.engines.node).toBe(SUPPORTED_NODE);
  });

  it.each(['22.22.3', 'v22.23.0', '24.15.0', '24.16.1', '26.0.0', '27.1.0'])(
    'accepts %s',
    (version) => {
      expect(supportsNode(version)).toBe(true);
      expect(nodeVersionProblem(version)).toBeNull();
    },
  );

  it.each([
    '20.19.0',
    '22.22.2',
    '22.12.0',
    '23.5.0',
    '24.14.9',
    '25.0.0',
    'unknown',
  ])('refuses %s', (version) => {
    expect(supportsNode(version)).toBe(false);
  });

  it('names the running version in the problem', () => {
    expect(nodeVersionProblem('v23.5.0')).toContain('this is Node.js 23.5.0.');
  });
});
