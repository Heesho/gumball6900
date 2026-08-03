import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

  it('uses a dependency-free bootstrap before loading the TypeScript/Hardhat processes', () => {
    const bootstrap = readFileSync(new URL('../scripts/keyless-deployment-bootstrap.mjs', import.meta.url), 'utf8');
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(bootstrap).not.toMatch(/^import .* from ['"](?:tsx|hardhat|ethers|viem|zod)['"]/m);
    expect(bootstrap.indexOf('const secrets = populated')).toBeLessThan(bootstrap.indexOf('spawn(command'));
    expect(packageJson.scripts['deployment:run']).toBe('node scripts/keyless-deployment-bootstrap.mjs authorized');
    expect(packageJson.scripts['deployment:prepare:local']).toBe(
      'node scripts/keyless-deployment-bootstrap.mjs prepare-local',
    );
  });

  it('aborts the dependency-free bootstrap before child startup when a signer variable is present', () => {
    const bootstrap = fileURLToPath(new URL('../scripts/keyless-deployment-bootstrap.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [bootstrap, 'authorized'], {
      encoding: 'utf8',
      env: { DEPLOYER_PRIVATE_KEY: 'not-a-real-secret', PATH: process.env.PATH },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refused inherited signer-secret variables: DEPLOYER_PRIVATE_KEY');
    expect(result.stderr).not.toContain('Missing required --authorization');
  });
});
