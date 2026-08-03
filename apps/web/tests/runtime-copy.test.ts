import { describe, expect, it } from 'vitest';

import { getRuntimeStatusCopy } from '../lib/runtime-copy';
import type { DemoRuntimeDeployment, LiveRuntimeDeployment } from '../lib/runtime-types';
import { liveRuntimeFixture } from './live-runtime-fixture';

const demoRuntime: DemoRuntimeDeployment = {
  mode: 'demo',
  fallbackReason: 'explicit-demo',
  chain: liveRuntimeFixture.chain,
  issues: ['Demo mode is explicitly selected.'],
  addresses: null,
  assets: {},
  assetMetadata: {},
  strategies: {},
  rewards: {},
  externalContracts: null,
  admin: null,
  subgraphUrl: null,
  manifest: null,
};

describe('runtime release copy', () => {
  it('never emits a positive deployment claim for demo mode', () => {
    const copy = Object.values(getRuntimeStatusCopy(demoRuntime)).join(' ');
    expect(copy).toBe('Safe demo fallback Safe demo Demo only');
    expect(copy).not.toMatch(/\b(?:live deployment|validated|deployed|launched)\b/iu);
  });

  it('emits live deployment language only for a validated production runtime', () => {
    expect(getRuntimeStatusCopy(liveRuntimeFixture)).toEqual({
      bannerTitle: 'Validated live deployment',
      networkLabel: 'Live deployment',
      walletLabel: 'Validated release',
    });

    const rehearsal = {
      ...liveRuntimeFixture,
      runtimeKind: 'local-rehearsal',
      manifest: { ...liveRuntimeFixture.manifest, status: 'testnet-candidate' },
    } as const satisfies LiveRuntimeDeployment;
    const rehearsalCopy = Object.values(getRuntimeStatusCopy(rehearsal)).join(' ');
    expect(rehearsalCopy).toBe('Local Anvil rehearsal Local rehearsal Rehearsal');
    expect(rehearsalCopy).not.toMatch(/\b(?:live deployment|validated release)\b/iu);

    const testnet = {
      ...liveRuntimeFixture,
      runtimeKind: 'testnet-candidate',
      chain: { ...liveRuntimeFixture.chain, environment: 'testnet', id: 46630 },
      manifest: { ...liveRuntimeFixture.manifest, status: 'testnet-candidate' },
    } as const satisfies LiveRuntimeDeployment;
    const testnetCopy = Object.values(getRuntimeStatusCopy(testnet)).join(' ');
    expect(testnetCopy).toBe('Remote testnet candidate Testnet candidate Testnet candidate');
    expect(testnetCopy).not.toMatch(/\b(?:live deployment|validated release|release-approved)\b/iu);
  });
});
