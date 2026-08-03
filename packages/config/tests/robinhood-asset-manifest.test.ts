import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { getAddress, keccak256, stringToHex } from 'viem';
import { describe, expect, it } from 'vitest';

import { deterministicJson } from '../tooling/deterministic-json.js';
import {
  assertReviewedRobinhoodAssetManifestMatchesDeploymentConfig,
  parseReviewedRobinhoodAssetManifest,
  validateReviewedRobinhoodAssetManifestAtHead,
} from '../tooling/reviewed-robinhood-asset-manifest.js';
import { buildRobinhoodAssetManifest } from '../tooling/robinhood-asset-manifest.js';
import {
  FIXTURE_BEACON_CREATION_BLOCK,
  FIXTURE_PINNED_BLOCK,
  FIXTURE_PINNED_BLOCK_HASH,
  FIXTURE_STOCK_BEACON,
  FIXTURE_STOCK_IMPLEMENTATION,
  RobinhoodAssetFixtureRpc,
} from './fixture-rpc.js';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/robinhood-assets.2026-08-01.json', import.meta.url), 'utf8'),
) as unknown;
const observedAt = '2026-08-02T02:59:56Z';

function mutableFixture(): { assets: Array<Record<string, unknown>> } {
  return structuredClone(fixture) as { assets: Array<Record<string, unknown>> };
}

function git(repository: string, arguments_: readonly string[]): string {
  return execFileSync('git', ['-C', repository, ...arguments_], { encoding: 'utf8' }).trim();
}

describe('Robinhood asset manifest generator', () => {
  it('builds deterministic, sorted, unapproved output from the captured fixture', async () => {
    const first = await buildRobinhoodAssetManifest({
      blockNumber: FIXTURE_PINNED_BLOCK,
      observedAt,
      registryPayload: fixture,
      rpc: new RobinhoodAssetFixtureRpc(fixture),
    });
    const reordered = mutableFixture();
    reordered.assets.reverse();
    const second = await buildRobinhoodAssetManifest({
      observedAt,
      registryPayload: reordered,
      rpc: new RobinhoodAssetFixtureRpc(reordered),
    });

    expect(deterministicJson(first)).toBe(deterministicJson(second));
    expect(first.assets.map(({ symbol }) => symbol)).toEqual(['AAPL', 'NVDA', 'QQQ', 'SPCX', 'TSLA']);
    expect(first.deploymentApproved).toBe(false);
    expect(first.assets.every(({ validations }) => validations.balanceOfCallable)).toBe(true);
    expect(first.assets.every(({ validations }) => validations.transferSimulationSucceeded)).toBe(true);
    expect(first.source).toMatchObject({
      blockHash: FIXTURE_PINNED_BLOCK_HASH,
      blockNumber: FIXTURE_PINNED_BLOCK.toString(),
      blockTimestamp: '2026-08-02T02:59:56.000Z',
      observedAt: '2026-08-02T02:59:56.000Z',
    });
    expect(first.stockTokenDependency).toMatchObject({
      beaconAddress: FIXTURE_STOCK_BEACON,
      beaconPaused: false,
      implementationAddress: FIXTURE_STOCK_IMPLEMENTATION,
    });
    expect(first.stockTokenDependency.accessControl.controlEventLog).toMatchObject({
      accessControlEventCount: 19,
      blocklistEventCount: 250,
      eventCount: 274,
      fromBlock: FIXTURE_BEACON_CREATION_BLOCK.toString(),
      pauseEventCount: 3,
      toBlock: FIXTURE_PINNED_BLOCK.toString(),
      upgradeEventCount: 2,
    });
    expect(first.stockTokenDependency.accessControl.blockedAccounts).toHaveLength(242);
    expect(first.stockTokenDependency.accessControl.roles).toHaveLength(13);
    expect(
      first.stockTokenDependency.accessControl.roles.every(
        ({ adminRole, members }) =>
          BigInt(adminRole) === 0n && members.length === 1 && members[0]!.accountType === 'eoa',
      ),
    ).toBe(true);
    expect(first.gates).toEqual({
      compliance: 'unresolved',
      testnetDependencies: 'unresolved',
      wrappedBtc: 'unresolved',
    });
  });

  it('rejects an explicit block pin that the RPC cannot reproduce', async () => {
    await expect(
      buildRobinhoodAssetManifest({
        blockNumber: FIXTURE_PINNED_BLOCK + 1n,
        observedAt,
        registryPayload: fixture,
        rpc: new RobinhoodAssetFixtureRpc(fixture),
      }),
    ).rejects.toThrow('observedAt');
  });

  it('rejects an unexpected RPC chain', async () => {
    await expect(
      buildRobinhoodAssetManifest({
        observedAt,
        registryPayload: fixture,
        rpc: new RobinhoodAssetFixtureRpc(fixture, { chainId: 1 }),
      }),
    ).rejects.toThrow('RPC chain mismatch');
  });

  it('rejects inactive, duplicate, address-drifted, or UID-drifted registry records', async () => {
    const inactive = mutableFixture();
    inactive.assets.find(({ tokenSymbol }) => tokenSymbol === 'AAPL')!.status = 'ASSET_STATUS_INACTIVE';
    await expect(
      buildRobinhoodAssetManifest({
        observedAt,
        registryPayload: inactive,
        rpc: new RobinhoodAssetFixtureRpc(inactive),
      }),
    ).rejects.toThrow('registry status');

    const duplicate = mutableFixture();
    duplicate.assets.push(structuredClone(duplicate.assets[0]!));
    await expect(
      buildRobinhoodAssetManifest({
        observedAt,
        registryPayload: duplicate,
        rpc: new RobinhoodAssetFixtureRpc(duplicate),
      }),
    ).rejects.toThrow('exactly one');

    const addressDrift = mutableFixture();
    const addressDeployment = (
      addressDrift.assets.find(({ tokenSymbol }) => tokenSymbol === 'AAPL')!.deployments as Array<
        Record<string, unknown>
      >
    )[0]!;
    addressDeployment.contractAddress = '0x1111111111111111111111111111111111111111';
    await expect(
      buildRobinhoodAssetManifest({
        observedAt,
        registryPayload: addressDrift,
        rpc: new RobinhoodAssetFixtureRpc(addressDrift),
      }),
    ).rejects.toThrow('address differs');

    const uidDrift = mutableFixture();
    uidDrift.assets.find(({ tokenSymbol }) => tokenSymbol === 'AAPL')!.id =
      '0x1111111111111111111111111111111111111111111111111111111111111111';
    await expect(
      buildRobinhoodAssetManifest({
        observedAt,
        registryPayload: uidDrift,
        rpc: new RobinhoodAssetFixtureRpc(uidDrift),
      }),
    ).rejects.toThrow('UID differs');
  });

  it.each([
    {
      expected: 'has no runtime bytecode',
      overrides: { emptyCodeSymbols: new Set(['AAPL']) },
    },
    {
      expected: 'decimals mismatch',
      overrides: { decimals: { AAPL: 6 } },
    },
    {
      expected: 'onchain symbol mismatch',
      overrides: { symbols: { AAPL: 'FAKE' } },
    },
    {
      expected: 'onchain UID does not match',
      overrides: {
        uids: { AAPL: '0x1111111111111111111111111111111111111111111111111111111111111111' as const },
      },
    },
    {
      expected: 'onchain multiplier does not match',
      overrides: { multipliers: { AAPL: 2n * 10n ** 18n } },
    },
    {
      expected: 'balanceOf did not return a standard uint256',
      overrides: { malformedBalanceOfSymbols: new Set(['AAPL']) },
    },
    {
      expected: 'zero-value transfer simulation returned false',
      overrides: { transferFailures: new Set(['AAPL']) },
    },
  ])('rejects failed onchain validation: $expected', async ({ expected, overrides }) => {
    await expect(
      buildRobinhoodAssetManifest({
        observedAt,
        registryPayload: fixture,
        rpc: new RobinhoodAssetFixtureRpc(fixture, overrides),
      }),
    ).rejects.toThrow(expected);
  });

  it.each([
    {
      expected: 'canonical stock BeaconProxy runtime',
      overrides: { distinctProxyCodeSymbols: new Set(['NVDA']) },
    },
    {
      expected: 'points to a different stock beacon',
      overrides: { proxyBeacons: { NVDA: getAddress('0x0000000000000000000000000000000000001111') } },
    },
    {
      expected: 'ACCESS_CONTROLLED_REGISTRY does not match its beacon',
      overrides: {
        accessControlledRegistries: { AAPL: getAddress('0x0000000000000000000000000000000000001111') },
      },
    },
    { expected: 'is not fully active', overrides: { tokenPauses: { AAPL: true } } },
    { expected: 'is not fully active', overrides: { oraclePauses: { AAPL: true } } },
    { expected: 'registry is paused', overrides: { beaconPaused: true } },
    {
      expected: 'implementation ACCESS_CONTROLLED_REGISTRY',
      overrides: { implementationRegistry: getAddress('0x0000000000000000000000000000000000001111') },
    },
    {
      expected: 'getRoleAdmin(DEFAULT_ADMIN_ROLE)',
      overrides: {
        roleAdmins: {
          [`0x${'00'.repeat(32)}`]: keccak256(stringToHex('PAUSER_ROLE')),
        },
      },
    },
    {
      expected: 'differs from replayed event state',
      overrides: { flipHasRoleAccounts: new Set(['0xd6f8378f8e440c65f8382f5f2728c78dfd55b66d']) },
    },
    {
      expected: 'Pinned block hash or timestamp drifted',
      overrides: { finalPinnedBlockHash: `0x${'11'.repeat(32)}` as const },
    },
  ])('rejects stock control-plane drift: $expected', async ({ expected, overrides }) => {
    await expect(
      buildRobinhoodAssetManifest({
        observedAt,
        registryPayload: fixture,
        rpc: new RobinhoodAssetFixtureRpc(fixture, overrides),
      }),
    ).rejects.toThrow(expected);
  });

  it('records a runtime bytecode hash for contract role members and an explicit marker for EOAs', async () => {
    const contractMember = '0x2b94105fff37630f98e1f24811dad588fc5c3a87';
    const manifest = await buildRobinhoodAssetManifest({
      observedAt,
      registryPayload: fixture,
      rpc: new RobinhoodAssetFixtureRpc(fixture, { contractRoleMembers: new Set([contractMember]) }),
    });
    const minter = manifest.stockTokenDependency.accessControl.roles.find(
      ({ roleName }) => roleName === 'MINTER_ROLE',
    )!;
    expect(minter.members).toEqual([
      expect.objectContaining({ accountType: 'contract', address: getAddress(contractMember) }),
    ]);
    expect(minter.members[0]!.runtimeBytecodeHash).toMatch(/^0x[0-9a-f]{64}$/);
    const admin = manifest.stockTokenDependency.accessControl.roles.find(
      ({ roleName }) => roleName === 'DEFAULT_ADMIN_ROLE',
    )!;
    expect(admin.members[0]).toMatchObject({ accountType: 'eoa', runtimeBytecodeHash: null });
  });
});

describe('reviewed Robinhood asset candidate', () => {
  it('requires the fixed dated path, canonical JSON, and exact tracked HEAD bytes', async () => {
    const manifest = await buildRobinhoodAssetManifest({
      observedAt,
      registryPayload: fixture,
      rpc: new RobinhoodAssetFixtureRpc(fixture),
    });
    const content = deterministicJson(manifest);
    const candidatePath = 'packages/config/deployments/robinhood-mainnet-assets.2026-08-02.candidate.json';

    expect(() =>
      parseReviewedRobinhoodAssetManifest(
        'packages/config/deployments/generated/robinhood-mainnet.assets.json',
        content,
      ),
    ).toThrow('fixed dated path');
    expect(() =>
      parseReviewedRobinhoodAssetManifest(
        'packages/config/deployments/robinhood-mainnet-assets.2026-08-03.candidate.json',
        content,
      ),
    ).toThrow('does not match source.observedAt');
    expect(() => parseReviewedRobinhoodAssetManifest(candidatePath, `${content} `)).toThrow('canonical deterministic');

    const repository = await mkdtemp(path.join(os.tmpdir(), 'gbx-reviewed-assets-'));
    try {
      execFileSync('git', ['init', '--quiet', repository]);
      git(repository, ['config', 'user.email', 'asset-review-test@example.com']);
      git(repository, ['config', 'user.name', 'Asset Review Test']);
      await writeFile(path.join(repository, 'README.md'), 'reviewed source\n', 'utf8');
      git(repository, ['add', 'README.md']);
      git(repository, ['commit', '--quiet', '-m', 'initial source']);

      const destination = path.join(repository, candidatePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, content, { encoding: 'utf8', mode: 0o644 });
      const initialCommit = git(repository, ['rev-parse', 'HEAD']);
      await expect(
        validateReviewedRobinhoodAssetManifestAtHead({
          expectedCommit: initialCommit,
          repositoryRelativePath: candidatePath,
          repositoryRoot: repository,
        }),
      ).rejects.toThrow('is not tracked');

      git(repository, ['add', candidatePath]);
      git(repository, ['commit', '--quiet', '-m', 'reviewed asset candidate']);
      const candidateCommit = git(repository, ['rev-parse', 'HEAD']);
      await expect(
        validateReviewedRobinhoodAssetManifestAtHead({
          expectedCommit: candidateCommit,
          repositoryRelativePath: candidatePath,
          repositoryRoot: repository,
        }),
      ).resolves.toEqual(manifest);

      await chmod(destination, 0o755);
      await expect(
        validateReviewedRobinhoodAssetManifestAtHead({
          expectedCommit: candidateCommit,
          repositoryRelativePath: candidatePath,
          repositoryRoot: repository,
        }),
      ).rejects.toThrow('must be nonexecutable');

      await chmod(destination, 0o644);
      await writeFile(destination, `${content} `, 'utf8');
      await expect(
        validateReviewedRobinhoodAssetManifestAtHead({
          expectedCommit: candidateCommit,
          repositoryRelativePath: candidatePath,
          repositoryRoot: repository,
        }),
      ).rejects.toThrow('do not exactly match');
    } finally {
      await rm(repository, { force: true, recursive: true });
    }
  });

  it('binds the deployment config to the exact reviewed beacon and implementation evidence', async () => {
    const manifest = await buildRobinhoodAssetManifest({
      observedAt,
      registryPayload: fixture,
      rpc: new RobinhoodAssetFixtureRpc(fixture),
    });
    const config = {
      assets: {
        assetIds: manifest.assets.map(({ uid }) => uid),
        decimals: manifest.assets.map(({ decimals }) => decimals),
        isStockToken: manifest.assets.map(() => true),
        runtimeBytecodeHashes: manifest.assets.map(({ runtimeBytecodeHash }) => runtimeBytecodeHash),
        symbolHashes: manifest.assets.map(({ symbol }) => keccak256(stringToHex(symbol))),
        tokens: manifest.assets.map(({ address }) => address),
        uiMultipliers: manifest.assets.map(({ currentMultiplier }) => currentMultiplier),
      },
      stockTokenDependency: {
        beaconAddress: manifest.stockTokenDependency.beaconAddress,
        beaconRuntimeBytecodeHash: manifest.stockTokenDependency.beaconRuntimeBytecodeHash,
        implementationAddress: manifest.stockTokenDependency.implementationAddress,
        implementationRuntimeBytecodeHash: manifest.stockTokenDependency.implementationRuntimeBytecodeHash,
      },
    };
    expect(() => assertReviewedRobinhoodAssetManifestMatchesDeploymentConfig(manifest, config)).not.toThrow();
    expect(() =>
      assertReviewedRobinhoodAssetManifestMatchesDeploymentConfig(manifest, {
        ...config,
        stockTokenDependency: {
          ...config.stockTokenDependency,
          implementationRuntimeBytecodeHash: `0x${'11'.repeat(32)}`,
        },
      }),
    ).toThrow('stock-token dependency');
    expect(() =>
      assertReviewedRobinhoodAssetManifestMatchesDeploymentConfig(manifest, {
        ...config,
        stockTokenDependency: null,
      }),
    ).toThrow('lacks the reviewed stock-token dependency');
  });
});
