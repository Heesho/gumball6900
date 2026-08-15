/**
 * Current deployment and release tooling is intentionally unavailable.
 *
 * The retained schema-v3 manifest and Safe control-plane validators describe a
 * removed protocol graph. They remain available only through the explicit
 * `@gumball-6900/config/archival-release` entrypoint.
 */
export const CURRENT_RELEASE_TOOLING_BLOCKER =
  'Current ProtocolGovernor deployment/release tooling is unavailable: the retained schema-v3 and Safe validators ' +
  'describe the removed AllocationVoter graph. A separately reviewed current manifest and evidence schema is ' +
  'required before deployment or subgraph outputs can be derived.';

export const currentReleaseToolingStatus = Object.freeze({
  architecture: 'protocol-governor',
  kind: 'gumball-6900-current-release-tooling-status',
  protocol: 'GUM BALL 6900',
  reason: CURRENT_RELEASE_TOOLING_BLOCKER,
  schemaVersion: 1,
  state: 'blocked',
} as const);

/** Fails closed until a reviewed manifest/evidence format exists for the current core. */
export function assertCurrentReleaseToolingAvailable(): never {
  throw new Error(CURRENT_RELEASE_TOOLING_BLOCKER);
}
