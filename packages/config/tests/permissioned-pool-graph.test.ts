import { describe, expect, it } from 'vitest';

import { parsePermissionedPoolGraph, UNISWAP_PERMISSIONED_SOURCE_PINS } from '../schemas/permissioned-pool-graph.js';

const address = (suffix: number) => `0x${suffix.toString(16).padStart(40, '0')}`;
const hash = (suffix: number) => `0x${suffix.toString(16).padStart(64, '0')}`;
const contract = (suffix: number) => ({ address: address(suffix), runtimeBytecodeHash: hash(suffix) });

function graphFixture() {
  const contracts = {
    adapterVerificationEscrow: contract(1),
    eligibilityAllowlistChecker: contract(13),
    emergencyGuardian: contract(18),
    gbxPermissionsAdapter: contract(2),
    gumBallPermissionedHook: {
      address: address(0x28c0),
      runtimeBytecodeHash: hash(3),
    },
    mixedRouteQuoterV2: contract(4),
    permissionedLiquidityManager: contract(5),
    permissionedPoolController: contract(11),
    permissionedPositionManager: contract(6),
    permissionsAdapterFactory: contract(7),
    protocolTimelock: contract(17),
    universalRouter: contract(8),
    v4Quoter: contract(9),
  };
  const usdG = address(10);
  const sorted = [contracts.gbxPermissionsAdapter.address, usdG].sort((left, right) =>
    BigInt(left) < BigInt(right) ? -1 : 1,
  );
  return {
    contracts,
    evidence: { independentSecurityReview: null, legalDecision: null, robinhoodForkRehearsal: null },
    kind: 'gumball-6900-permissioned-pool-graph',
    network: { chainId: 31_337, name: 'Hardhat Local Rehearsal' },
    pool: {
      currency0: sorted[0],
      currency1: sorted[1],
      fee: 3_000,
      hook: contracts.gumBallPermissionedHook.address,
      tickSpacing: 60,
    },
    protocol: 'GUM BALL 6900',
    relationships: {
      adapterAdmin: contracts.permissionedPoolController.address,
      adapterFactory: contracts.permissionsAdapterFactory.address,
      adapterUnderlyingToken: address(12),
      allowListChecker: contracts.eligibilityAllowlistChecker.address,
      allowedWrappers: [
        contracts.permissionedPositionManager.address,
        contracts.universalRouter.address,
        contracts.v4Quoter.address,
        contracts.mixedRouteQuoterV2.address,
      ],
      gbx: address(12),
      dependencyInitializer: address(16),
      controllerAdapter: contracts.gbxPermissionsAdapter.address,
      controllerEmergencyGuardian: contracts.emergencyGuardian.address,
      controllerHook: contracts.gumBallPermissionedHook.address,
      controllerProtocolTimelock: contracts.protocolTimelock.address,
      controllerVerificationEscrow: contracts.adapterVerificationEscrow.address,
      graphInitialized: true,
      hookAdapterFactory: contracts.permissionsAdapterFactory.address,
      liquidityPositionOwner: contracts.permissionedLiquidityManager.address,
      permit2: address(14),
      poolManager: address(15),
      positionManagerAdapterFactory: contracts.permissionsAdapterFactory.address,
      swappingEnabled: false,
      usdG,
      verificationWrapper: contracts.adapterVerificationEscrow.address,
    },
    releaseEligible: false,
    schemaVersion: 1,
    sourcePins: structuredClone(UNISWAP_PERMISSIONED_SOURCE_PINS),
    status: 'draft',
  };
}

describe('permissionedPoolGraphSchema', () => {
  it('accepts a completely bound local candidate graph', () => {
    expect(parsePermissionedPoolGraph(graphFixture()).releaseEligible).toBe(false);
  });

  it('rejects a source-pin substitution', () => {
    const candidate = graphFixture();
    candidate.sourcePins = {
      ...candidate.sourcePins,
      hooks: { ...candidate.sourcePins.hooks, commit: '1'.repeat(40) },
    } as typeof candidate.sourcePins;
    expect(() => parsePermissionedPoolGraph(candidate)).toThrow();
  });

  it('rejects a raw GBX PoolKey instead of the adapter', () => {
    const candidate = graphFixture();
    candidate.pool.currency0 = candidate.relationships.gbx;
    expect(() => parsePermissionedPoolGraph(candidate)).toThrow(/GBX adapter/);
  });

  it('rejects an unbound wrapper order', () => {
    const candidate = graphFixture();
    [candidate.relationships.allowedWrappers[0], candidate.relationships.allowedWrappers[1]] = [
      candidate.relationships.allowedWrappers[1]!,
      candidate.relationships.allowedWrappers[0]!,
    ];
    expect(() => parsePermissionedPoolGraph(candidate)).toThrow(/Allowed wrappers/);
  });

  it('rejects a hook address whose v4 permission bits do not match the implementation', () => {
    const candidate = graphFixture();
    candidate.contracts.gumBallPermissionedHook.address = address(3);
    candidate.pool.hook = address(3);
    expect(() => parsePermissionedPoolGraph(candidate)).toThrow(/must encode beforeInitialize/);
  });

  it('requires all review evidence before a nonlocal candidate state', () => {
    const candidate = graphFixture();
    candidate.network = { chainId: 4_663, name: 'Robinhood Chain' } as typeof candidate.network;
    candidate.status = 'review-candidate';
    expect(() => parsePermissionedPoolGraph(candidate)).toThrow(
      /requires security, legal, and Robinhood fork evidence/,
    );
  });
});
