import { describe, expect, it } from 'vitest';

import {
  PERMISSIONED_POOL_OFFICIAL_ARTIFACTS,
  assertFreshPermissionedPoolForkRehearsal,
  parsePermissionedPoolForkRehearsal,
  parsePermissionedPoolOfficialSourceBuild,
} from '../schemas/permissioned-pool-release-evidence.js';
import { UNISWAP_PERMISSIONED_SOURCE_PINS } from '../schemas/permissioned-pool-graph.js';

const address = (suffix: number) => `0x${suffix.toString(16).padStart(40, '0')}`;
const bytes32 = (suffix: number) => `0x${suffix.toString(16).padStart(64, '0')}`;
const rawHash = (suffix: number) => suffix.toString(16).padStart(64, '0');
const principal = (millions: number) => (BigInt(millions) * 1_000_000n * 10n ** 18n).toString();

function officialDependency(key: keyof typeof PERMISSIONED_POOL_OFFICIAL_ARTIFACTS, suffix: number) {
  const artifact = PERMISSIONED_POOL_OFFICIAL_ARTIFACTS[key];
  const pin = UNISWAP_PERMISSIONED_SOURCE_PINS[artifact.sourcePin];
  return {
    address: address(suffix),
    artifactCreationBytecodeHash: bytes32(100 + suffix),
    constructorArgumentsHash: bytes32(200 + suffix),
    contractName: artifact.contractName,
    reproducedRuntimeBytecodeHash: bytes32(300 + suffix),
    runtimeBytecodeHash: bytes32(300 + suffix),
    sourceCommit: pin.commit,
    sourcePath: artifact.sourcePath,
    sourceRepository: pin.repository,
  };
}

function sourceArchive(key: keyof typeof UNISWAP_PERMISSIONED_SOURCE_PINS, suffix: number) {
  const pin = UNISWAP_PERMISSIONED_SOURCE_PINS[key];
  return { commit: pin.commit, rawSha256: rawHash(suffix), repository: pin.repository };
}

function sourceBuildFixture() {
  return {
    build: {
      command: 'pnpm reproduce:permissioned-pool',
      completedAt: '2026-08-01T00:00:00Z',
      compiler: { settingsSha256: rawHash(20), version: '0.8.26+commit.8a97fa7a' },
      environment: {
        image: 'ghcr.io/gumball-6900/reproducible-solidity-build',
        imageDigest: `sha256:${rawHash(21)}`,
        platform: 'linux/amd64',
      },
      lockfile: { path: 'evidence/official-source-build.lock.json', rawSha256: rawHash(22) },
    },
    dependencies: {
      mixedRouteQuoterV2: officialDependency('mixedRouteQuoterV2', 1),
      permissionedPositionManager: officialDependency('permissionedPositionManager', 2),
      permissionsAdapterFactory: officialDependency('permissionsAdapterFactory', 3),
      universalRouter: officialDependency('universalRouter', 4),
      v4Quoter: officialDependency('v4Quoter', 5),
    },
    kind: 'gumball-6900-permissioned-pool-official-source-build',
    network: { chainId: 4_663, name: 'Robinhood Chain' },
    protocol: 'GUM BALL 6900',
    schemaVersion: 1,
    sourceArchives: {
      hooks: sourceArchive('hooks', 30),
      mixedQuoter: sourceArchive('mixedQuoter', 31),
      periphery: sourceArchive('periphery', 32),
      universalRouter: sourceArchive('universalRouter', 33),
    },
    sourcePins: structuredClone(UNISWAP_PERMISSIONED_SOURCE_PINS),
    status: 'reproduced',
  };
}

function forkFixture() {
  const adapter = address(2);
  const usdG = address(10);
  return {
    adapter: {
      address: adapter,
      admin: address(11),
      allowListChecker: address(13),
      poolManagerBalance: principal(20),
      permissionedPoolController: address(11),
      swappingEnabled: true,
      totalSupply: principal(20),
      underlyingBalance: principal(20),
      underlyingGBX: address(12),
    },
    authorizationEligible: true,
    block: {
      confirmations: '64',
      expiresAt: '2026-08-01T12:00:00Z',
      hash: bytes32(40),
      number: '1000000',
      observedAt: '2026-08-01T00:00:00Z',
      parentHash: bytes32(39),
    },
    evidence: {
      deploymentConfig: { path: 'evidence/testnet-config.json', rawSha256: rawHash(40) },
      deploymentState: { path: 'evidence/testnet-state.json', rawSha256: rawHash(41) },
      officialSourceBuild: { path: 'evidence/official-source-build.json', rawSha256: rawHash(42) },
      permissionedPoolGraph: { path: 'evidence/testnet-permissioned-graph.json', rawSha256: rawHash(43) },
    },
    genesis: {
      activePositionCount: 4,
      adapterPrincipal: principal(20),
      claimsAllocation: principal(80),
      cumulativeMinted: principal(100),
      liquidityAllocation: principal(20),
      managerResidual: '0',
      positions: [1, 2, 3, 4].map((tokenId) => ({
        exists: true,
        gbxPrincipal: principal(5),
        tokenId: String(tokenId),
      })),
      totalSupply: principal(100),
    },
    kind: 'gumball-6900-permissioned-pool-robinhood-fork-rehearsal',
    network: { chainId: 46_630, name: 'Robinhood Chain Testnet' },
    pool: {
      currency0: adapter,
      currency1: usdG,
      fee: 3_000,
      hook: address(0x28c0),
      hookPermissionBits: '0x28c0',
      initialized: true,
      poolId: bytes32(44),
      tickSpacing: 60,
      usdG,
    },
    protocol: 'GUM BALL 6900',
    schemaVersion: 1,
    state: { configHash: bytes32(45), phase: 'GENESIS_SETTLED', sourceCommit: 'a'.repeat(40) },
    status: 'passed',
    swapActivation: {
      bootstrapEnableConsumed: true,
      permissionlessSwapSucceeded: true,
      permissionlessSwapTransactionHash: bytes32(47),
      swappingEnabled: true,
      transactionHash: bytes32(46),
    },
  };
}

describe('permissioned pool release evidence', () => {
  it('accepts exact official-source reproduction evidence', () => {
    expect(parsePermissionedPoolOfficialSourceBuild(sourceBuildFixture()).status).toBe('reproduced');
  });

  it('rejects substituted source pins and unreproduced runtime bytecode', () => {
    const wrongPin = sourceBuildFixture();
    (wrongPin.dependencies.permissionsAdapterFactory as { sourceCommit: string }).sourceCommit = 'b'.repeat(40);
    expect(() => parsePermissionedPoolOfficialSourceBuild(wrongPin)).toThrow();

    const wrongRuntime = sourceBuildFixture();
    wrongRuntime.dependencies.universalRouter.reproducedRuntimeBytecodeHash = bytes32(999);
    expect(() => parsePermissionedPoolOfficialSourceBuild(wrongRuntime)).toThrow(/reproduced runtime bytecode/);
  });

  it('accepts a fresh, fully conserved permissioned Robinhood fork rehearsal', () => {
    expect(assertFreshPermissionedPoolForkRehearsal(forkFixture(), Date.parse('2026-08-01T01:00:00Z')).status).toBe(
      'passed',
    );
  });

  it('rejects under-confirmed, unbacked, or non-permissionless fork outcomes', () => {
    const underConfirmed = forkFixture();
    underConfirmed.block.confirmations = '63';
    expect(() => parsePermissionedPoolForkRehearsal(underConfirmed)).toThrow(/at least 64 confirmations/);

    const unbacked = forkFixture();
    unbacked.adapter.underlyingBalance = principal(19);
    expect(() => parsePermissionedPoolForkRehearsal(unbacked)).toThrow(/underlying balance/);

    const disabled = forkFixture();
    disabled.swapActivation.permissionlessSwapSucceeded = false;
    expect(() => parsePermissionedPoolForkRehearsal(disabled)).toThrow();
  });

  it('rejects evidence after its signed validity window', () => {
    expect(() => assertFreshPermissionedPoolForkRehearsal(forkFixture(), Date.parse('2026-08-01T13:00:00Z'))).toThrow(
      /expired/,
    );
  });
});
