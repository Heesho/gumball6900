import { describe, expect, it } from 'vitest';

import {
  assertKeylessEnvironment,
  keylessHardhatEnvironment,
  signerSecretEnvironmentVariables,
} from '../tooling/signer-environment.js';

describe('keyless deployment process boundary', () => {
  it('rejects every repository-recognized signer secret and Node preload control', () => {
    for (const name of signerSecretEnvironmentVariables) {
      expect(() => assertKeylessEnvironment({ [name]: 'not-a-real-secret' })).toThrow(name);
    }
    expect(() => assertKeylessEnvironment({ NODE_OPTIONS: '--require hostile-preload.js' })).toThrow('NODE_OPTIONS');
    expect(() => assertKeylessEnvironment({ NODE_PATH: '/unreviewed/modules' })).toThrow('NODE_PATH');
  });

  it('passes only an allowlisted environment and cannot reintroduce a key through additions', () => {
    const child = keylessHardhatEnvironment(
      {
        HOME: '/operator-home',
        PATH: '/reviewed/bin',
        UNRELATED_CREDENTIAL: 'must-not-cross-the-boundary',
      },
      { DEPLOYMENT_PHASE: 'schedule' },
    );
    expect(child).toEqual({
      DEPLOYMENT_PHASE: 'schedule',
      HOME: '/operator-home',
      PATH: '/reviewed/bin',
    });
    expect(() => keylessHardhatEnvironment({}, { DEPLOYER_PRIVATE_KEY: 'not-a-real-secret' })).toThrow(
      'forbidden additions',
    );
  });
});
