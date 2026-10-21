export const SUPPORTED_NODE = '^22.22.3 || ^24.15.0 || >=26.0.0';

const SUPPORTED_NODE_DESCRIPTION =
  '22.22.3 or a later 22.x, 24.15.0 or a later 24.x, or 26 and later';

const MINIMUM_PER_MAJOR: Record<number, [number, number]> = {
  22: [22, 3],
  24: [15, 0],
};

const FIRST_OPEN_MAJOR = 26;

function parseVersion(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version);
  return match === null
    ? null
    : [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function supportsNode(version: string): boolean {
  const parsed = parseVersion(version);
  if (parsed === null) {
    return false;
  }
  const [major, minor, patch] = parsed;
  if (major >= FIRST_OPEN_MAJOR) {
    return true;
  }
  const minimum = MINIMUM_PER_MAJOR[major];
  if (minimum === undefined) {
    return false;
  }
  const [minimumMinor, minimumPatch] = minimum;
  return (
    minor > minimumMinor || (minor === minimumMinor && patch >= minimumPatch)
  );
}

export function nodeVersionProblem(version: string): string | null {
  return supportsNode(version)
    ? null
    : `pidrang needs Node.js ${SUPPORTED_NODE_DESCRIPTION}; this is Node.js ${version.replace(/^v/, '')}. Install a supported Node.js version and run pidrang init again.`;
}
