import { describe, expect, it } from 'vitest';

import * as activeConfig from '../index.js';
import * as archivalRelease from '../archival-release.js';

describe('current release boundary', () => {
  it('fails closed without exposing the removed manifest and Safe graph as current', () => {
    expect(activeConfig.currentReleaseToolingStatus).toMatchObject({
      architecture: 'external-governance-pending',
      state: 'blocked',
    });
    expect(() => activeConfig.assertCurrentReleaseToolingAvailable()).toThrow(
      /Current external-governance deployment\/release tooling is unavailable/,
    );

    expect('parseDeploymentManifest' in activeConfig).toBe(false);
    expect('parseDeploymentConfigEnvelope' in activeConfig).toBe(false);
    expect('parseSafeControlPlaneEvidence' in activeConfig).toBe(false);
  });

  it('retains old validators only behind the explicit archival entrypoint', () => {
    expect(archivalRelease.parseDeploymentManifest).toBeTypeOf('function');
    expect(archivalRelease.parseDeploymentConfigEnvelope).toBeTypeOf('function');
    expect(archivalRelease.parseSafeControlPlaneEvidence).toBeTypeOf('function');
  });
});
