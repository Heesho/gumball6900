import { readFileSync } from 'node:fs';

import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';

import {
  assertFreshReleaseEvidence,
  deploymentManifestSigningPayload,
  deploymentManifestSigningPayloadHash,
  parseDeploymentManifest,
  parseReleaseManifestSignaturePolicyConfiguration,
  requiredInitializationActionKeys,
  requiredMinimalExternalContractKeys,
  requiredMinimalProtocolContractNames,
  validateDeploymentManifest,
  type DeploymentManifest,
} from '../schemas/deployment-manifest.js';

const draftFixture = JSON.parse(
  readFileSync(new URL('./fixtures/deployment-manifest.draft.json', import.meta.url), 'utf8'),
) as unknown;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function address(index: number): `0x${string}` {
  return `0x${index.toString(16).padStart(40, '0')}`;
}

function hash(index: number): `0x${string}` {
  return `0x${index.toString(16).padStart(64, '0')}`;
}

function unresolvedCandidate() {
  const candidate = clone(draftFixture) as Record<string, unknown>;
  candidate.release = {
    createdAt: '2026-08-01T00:00:00Z',
    gitCommit: '1'.repeat(40),
    status: 'testnet-candidate',
    version: 'v0.1.0-testnet',
  };
  candidate.network = {
    archiveRpcProviderLabel: 'UNRESOLVED',
    chainId: 46630,
    explorerUrl: 'https://explorer.testnet.chain.robinhood.com',
    name: 'Robinhood Chain Testnet',
  };
  candidate.roles = {
    deployer: address(1),
    deployerPrivilegesRenouncedOrIrrelevant: false,
    guardianOperator: address(2),
    protocolProposer: address(3),
    team: address(0),
  };
  candidate.deployedContracts = requiredMinimalProtocolContractNames.map((name) => ({
    address: null,
    blockNumber: null,
    contractName: name,
    constructorArguments: [],
    encodedConstructorArguments: null,
    name,
    runtimeBytecodeHash: null,
    state: 'unresolved',
    transactionHash: null,
    verificationUrl: null,
  }));
  candidate.externalContracts = requiredMinimalExternalContractKeys.map((key) => ({
    address: null,
    key,
    runtimeBytecodeHash: null,
    sourceUrl: null,
    state: 'unresolved',
    verifiedAtBlock: null,
  }));
  return candidate;
}

function completeCandidate() {
  const candidate = unresolvedCandidate();
  const contractAddresses = new Map(
    requiredMinimalProtocolContractNames.map((name, index) => [name, address(100 + index)] as const),
  );
  const externalAddresses = new Map([
    ['USDG', address(10)],
    ['uniswapV4.positionManager', address(11)],
    ['uniswapV4.permit2', address(12)],
    ['uniswapV4.poolManager', address(13)],
  ] as const);
  candidate.deployedContracts = requiredMinimalProtocolContractNames.map((name, index) => ({
    address: contractAddresses.get(name),
    blockNumber: String(1_000 + index),
    contractName: name,
    constructorArguments: [address(1)],
    encodedConstructorArguments: '0x00',
    name,
    runtimeBytecodeHash: hash(100 + index),
    state: 'verified',
    transactionHash: hash(1_000 + index),
    verificationUrl: `https://explorer.example/address/${contractAddresses.get(name)}`,
  }));
  candidate.externalContracts = requiredMinimalExternalContractKeys.map((key, index) => ({
    address: externalAddresses.get(key),
    key,
    runtimeBytecodeHash: hash(200 + index),
    sourceUrl: `https://github.com/example/${index}`,
    state: 'verified',
    verifiedAtBlock: '900',
  }));
  candidate.roles = {
    deployer: address(1),
    deployerPrivilegesRenouncedOrIrrelevant: false,
    guardianOperator: address(2),
    protocolProposer: address(3),
    team: address(0),
  };

  const usdG = externalAddresses.get('USDG');
  const positionManager = externalAddresses.get('uniswapV4.positionManager');
  const permit2 = externalAddresses.get('uniswapV4.permit2');
  const gbx = contractAddresses.get('GBXToken');
  const miningPool = contractAddresses.get('MiningPool');
  const voter = contractAddresses.get('AllocationVoter');
  const vault = contractAddresses.get('GumBallVault');
  const registry = contractAddresses.get('AssetRegistry');
  const guardian = contractAddresses.get('EmergencyGuardian');
  const timelock = contractAddresses.get('ProtocolTimelock');
  const stakedGBX = contractAddresses.get('StakedGBX');
  const custodian = contractAddresses.get('LiquidityCustodian');
  const rewards = contractAddresses.get('StrategyRewards');
  const acquisition = contractAddresses.get('AcquisitionStrategy');
  const emissionController = contractAddresses.get('EmissionController');
  const acquisitionTarget = address(20);

  candidate.deploymentConfig = {
    acquisition: { initPrice: '1000000', minInitPrice: '1000000', usdGLot: '1000000000000000000' },
    acquisitionTarget,
    auctionEpochPeriod: '604800',
    auctionPriceMultiplier: '1100000000000000000',
    buyback: { initPrice: '2000000', minInitPrice: '1000000', usdGLot: '2000000000000000000' },
    deployer: address(1),
    guardianOperator: address(2),
    initialSqrtPriceX96: '79228162514264337593543950336',
    liquidityDeadline: '1800000000',
    permit2,
    poolKey: {
      currency0: usdG,
      currency1: gbx,
      fee: 3000,
      hooks: address(0),
      tickSpacing: 60,
    },
    positionManager,
    protocolProposer: address(3),
    team: address(0),
    tickLower: 120,
    tickUpper: 600,
    usdG,
  };
  const strategyBase = {
    assetRegistry: registry,
    emergencyGuardian: guardian,
    epochPeriod: '604800',
    priceMultiplier: '1100000000000000000',
    protocolTimelock: timelock,
    startTime: '0',
    usdG,
    vault,
  };
  candidate.initialState = {
    acquisitionStrategy: {
      ...strategyBase,
      initPrice: '1000000',
      minInitPrice: '1000000',
      strategyRewards: rewards,
      targetToken: acquisitionTarget,
      usdGLot: '1000000000000000000',
    },
    allocationVoter: {
      assetRegistry: registry,
      emergencyGuardian: guardian,
      liquidityCustodian: custodian,
      miningPool,
      protocolTimelock: timelock,
      stakedGBX,
      usdG,
      vault,
    },
    assetRegistry: {
      acquisitionStrategyLive: false,
      assetCount: '1',
      buybackStrategyLive: false,
      strategyCount: '0',
      usdG,
      usdGRegistered: true,
    },
    buybackStrategy: {
      ...strategyBase,
      gbx,
      initPrice: '2000000',
      minInitPrice: '1000000',
      usdGLot: '2000000000000000000',
    },
    deployerGbxBalance: '0',
    emergencyGuardian: { allocationVoter: voter, assetRegistry: registry, miningPool },
    gbx: { canonicalMiningPool: miningPool, emissionController },
    gumBallVault: { allocationVoter: voter, assetRegistry: registry, gbx, usdG },
    liquidity: {
      erc20Permit2AllowanceRevoked: true,
      gbxPrincipal: '19999999999999999999999999',
      gbxResidualBurned: '1',
      nftOwner: custodian,
      permit2AllowanceRevoked: true,
      poolManager: externalAddresses.get('uniswapV4.poolManager'),
      positionInCustody: true,
      positionLiquidity: '123456789',
      positionManager,
      positionTokenId: '1',
    },
    miningClaimsSource: miningPool,
    miningPool: { currentEpochId: '0', started: true },
    strategyRewards: { allocationVoter: voter, rewardToken: acquisitionTarget, strategy: acquisition },
    stakedGBX: { allocationVoter: voter, gbx },
  };
  candidate.initializationTransactions = requiredInitializationActionKeys.map((action, index) => ({
    action,
    blockNumber: String(2_000 + index),
    events: [
      {
        emitter: action.startsWith('UniswapV4') ? positionManager : address(50),
        logIndex: 0,
        signature: `${action}(...)`,
        topic0: hash(3_000 + index),
      },
    ],
    transactionHash: hash(2_000 + index),
  }));
  return candidate;
}

describe('minimal deployment manifest', () => {
  it('accepts an explicitly unresolved draft without invented addresses', () => {
    const manifest = parseDeploymentManifest(draftFixture);
    expect(manifest.schemaVersion).toBe(3);
    expect(manifest.roles.deployer).toBe(address(0));
    expect(manifest.deployedContracts).toEqual([]);
    expect(manifest.deploymentConfig).toBeNull();
  });

  it('accepts an unresolved candidate only when it lists the exact minimal graph', () => {
    const manifest = parseDeploymentManifest(unresolvedCandidate());
    expect(manifest.deployedContracts.map(({ name }) => name)).toEqual(requiredMinimalProtocolContractNames);
    expect(manifest.externalContracts.map(({ key }) => key)).toEqual(requiredMinimalExternalContractKeys);
    expect(manifest.deployedContracts.every(({ state }) => state === 'unresolved')).toBe(true);
  });

  it('rejects a candidate missing one of the 14 minimal contracts', () => {
    const candidate = unresolvedCandidate();
    candidate.deployedContracts = (candidate.deployedContracts as unknown[]).slice(1);
    expect(() => parseDeploymentManifest(candidate)).toThrow('exact 14-contract minimal deployment graph');
  });

  it('rejects every removed legacy graph name', () => {
    for (const removed of [
      'GenesisClaims',
      'StrategyDeployer',
      'EligibilityModule',
      'LiquidityManager',
      'GumBallRouter',
      'LaunchGuardHook',
      'ManagerRewards',
      'BuybackBurnStrategy',
    ]) {
      const candidate = unresolvedCandidate();
      (candidate.deployedContracts as Array<Record<string, unknown>>)[0]!.name = removed;
      expect(() => parseDeploymentManifest(candidate), removed).toThrow();
    }
  });

  it('keeps logical and source names identical', () => {
    const candidate = unresolvedCandidate();
    (candidate.deployedContracts as Array<Record<string, unknown>>)[0]!.contractName = 'EmergencyGuardian';
    expect(() => parseDeploymentManifest(candidate)).toThrow('must identify source contract');
  });

  it('requires deployment hashes and receipts only after a record resolves', () => {
    const candidate = unresolvedCandidate();
    const contract = (candidate.deployedContracts as Array<Record<string, unknown>>)[0]!;
    contract.state = 'deployed';
    contract.address = address(100);
    expect(() => parseDeploymentManifest(candidate)).toThrow('runtime bytecode hash must be nonzero');
  });

  it('accepts complete linked deployment and initialization evidence', () => {
    const manifest = parseDeploymentManifest(completeCandidate());
    expect(manifest.initialState?.strategyRewards.strategy).toBe(
      manifest.deployedContracts.find(({ name }) => name === 'AcquisitionStrategy')?.address,
    );
    expect(manifest.deploymentConfig?.poolKey.hooks).toBe(address(0));
    expect(manifest.deploymentConfig?.liquidityDeadline).toBe('1800000000');
    expect(manifest.initializationTransactions).toHaveLength(requiredInitializationActionKeys.length);
  });

  it('requires the explicit absolute liquidity deadline in resolved deployment evidence', () => {
    const candidate = completeCandidate();
    delete (candidate.deploymentConfig as Record<string, unknown>).liquidityDeadline;
    expect(() => parseDeploymentManifest(candidate)).toThrow();
  });

  it('rejects auction parameters outside the deployed AuctionEngine bounds', () => {
    const shortEpoch = completeCandidate();
    (shortEpoch.deploymentConfig as Record<string, unknown>).auctionEpochPeriod = '3599';
    expect(() => parseDeploymentManifest(shortEpoch)).toThrow('between one hour and 365 days');

    const lowMultiplier = completeCandidate();
    (lowMultiplier.deploymentConfig as Record<string, unknown>).auctionPriceMultiplier = '1099999999999999999';
    expect(() => parseDeploymentManifest(lowMultiplier)).toThrow('between 1.1e18 and 3e18');

    const lowPrice = completeCandidate();
    ((lowPrice.deploymentConfig as Record<string, unknown>).acquisition as Record<string, unknown>).initPrice =
      '999999';
    expect(() => parseDeploymentManifest(lowPrice)).toThrow('between 1e6 and uint192 max');
  });

  it('rejects impossible v4 fee, spacing, tick alignment, and uint160 sqrt inputs', () => {
    const dynamicFee = completeCandidate();
    ((dynamicFee.deploymentConfig as Record<string, unknown>).poolKey as Record<string, unknown>).fee = 1_000_001;
    expect(() => parseDeploymentManifest(dynamicFee)).toThrow();

    const negativeSpacing = completeCandidate();
    ((negativeSpacing.deploymentConfig as Record<string, unknown>).poolKey as Record<string, unknown>).tickSpacing = -1;
    expect(() => parseDeploymentManifest(negativeSpacing)).toThrow();

    const unaligned = completeCandidate();
    (unaligned.deploymentConfig as Record<string, unknown>).tickLower = 121;
    expect(() => parseDeploymentManifest(unaligned)).toThrow('must align to PoolKey tick spacing');

    const oversizedSqrtPrice = completeCandidate();
    (oversizedSqrtPrice.deploymentConfig as Record<string, unknown>).initialSqrtPriceX96 = (1n << 160n).toString();
    expect(() => parseDeploymentManifest(oversizedSqrtPrice)).toThrow('must fit uint160');
  });

  it('conserves the exact 20,000,000 GBX genesis allocation', () => {
    const candidate = completeCandidate();
    (candidate.initialState as Record<string, Record<string, unknown>>).liquidity!.gbxResidualBurned = '2';
    expect(() => parseDeploymentManifest(candidate)).toThrow('must equal the 20,000,000 GBX allocation');
  });

  it('binds the explicit deployer input to the recorded role', () => {
    const candidate = completeCandidate();
    (candidate.deploymentConfig as Record<string, unknown>).deployer = address(999);
    expect(() => parseDeploymentManifest(candidate)).toThrow('Deployment deployer must match the recorded role');
  });

  it('binds candidate status to the canonical Robinhood network', () => {
    const testnet = unresolvedCandidate();
    (testnet.network as Record<string, unknown>).chainId = 4663;
    expect(() => parseDeploymentManifest(testnet)).toThrow('must target Robinhood Chain Testnet 46630');

    const mainnet = unresolvedCandidate();
    (mainnet.release as Record<string, unknown>).status = 'mainnet-candidate';
    expect(() => parseDeploymentManifest(mainnet)).toThrow('must target Robinhood Chain 4663');
  });

  it('requires configuration and observed initial state together', () => {
    const candidate = completeCandidate();
    candidate.initialState = null;
    expect(() => parseDeploymentManifest(candidate)).toThrow('must be recorded together');
  });

  it('enforces a hookless sorted GBX/USDG PoolKey', () => {
    const withHook = completeCandidate();
    (withHook.deploymentConfig as Record<string, unknown>).poolKey = {
      ...((withHook.deploymentConfig as Record<string, unknown>).poolKey as Record<string, unknown>),
      hooks: address(999),
    };
    expect(() => parseDeploymentManifest(withHook)).toThrow();

    const unsorted = completeCandidate();
    const poolKey = (unsorted.deploymentConfig as Record<string, Record<string, unknown>>).poolKey!;
    [poolKey.currency0, poolKey.currency1] = [poolKey.currency1, poolKey.currency0];
    expect(() => parseDeploymentManifest(unsorted)).toThrow('currencies must be distinct and sorted');
  });

  it('binds StrategyRewards to the acquisition target, voter, and strategy', () => {
    const candidate = completeCandidate();
    (candidate.initialState as Record<string, Record<string, unknown>>).strategyRewards!.rewardToken = address(999);
    expect(() => parseDeploymentManifest(candidate)).toThrow('Rewards token must be target');
  });

  it('binds both auction economics and inactive start time to the deployment config', () => {
    const candidate = completeCandidate();
    (candidate.initialState as Record<string, Record<string, unknown>>).buybackStrategy!.usdGLot = '3';
    expect(() => parseDeploymentManifest(candidate)).toThrow('economics must match deployment configuration');

    const active = completeCandidate();
    (active.initialState as Record<string, Record<string, unknown>>).acquisitionStrategy!.startTime = '1';
    expect(() => parseDeploymentManifest(active)).toThrow();
  });

  it('rejects an acquisition target equal to USDG or GBX', () => {
    const usdGTarget = completeCandidate();
    const config = usdGTarget.deploymentConfig as Record<string, unknown>;
    config.acquisitionTarget = config.usdG;
    expect(() => parseDeploymentManifest(usdGTarget)).toThrow('must differ from USDG');

    const gbxTarget = completeCandidate();
    const gbx = (gbxTarget.deployedContracts as Array<Record<string, unknown>>).find(
      ({ name }) => name === 'GBXToken',
    )!.address;
    (gbxTarget.deploymentConfig as Record<string, unknown>).acquisitionTarget = gbx;
    (gbxTarget.initialState as Record<string, Record<string, unknown>>).acquisitionStrategy!.targetToken = gbx;
    (gbxTarget.initialState as Record<string, Record<string, unknown>>).strategyRewards!.rewardToken = gbx;
    expect(() => parseDeploymentManifest(gbxTarget)).toThrow('must differ from GBX');
  });

  it('fixes the initial registry to USDG-only with both strategies inactive', () => {
    const candidate = completeCandidate();
    (candidate.initialState as Record<string, Record<string, unknown>>).assetRegistry!.strategyCount = '1';
    expect(() => parseDeploymentManifest(candidate)).toThrow();
  });

  it('rejects duplicate initialization evidence keys', () => {
    const candidate = completeCandidate();
    const records = candidate.initializationTransactions as Array<Record<string, unknown>>;
    records[1]!.action = records[0]!.action;
    expect(() => parseDeploymentManifest(candidate)).toThrow('initialization action keys must be unique');
  });

  it('keeps release approval fail-closed without external evidence and signatures', () => {
    const candidate = completeCandidate();
    (candidate.release as Record<string, unknown>).status = 'release-approved';
    expect(() => parseDeploymentManifest(candidate)).toThrow(
      'Release approval requires hash-bound deployment evidence',
    );
  });

  it('requires evidence for every passed gate', () => {
    const candidate = unresolvedCandidate();
    const gates = candidate.gates as Record<string, Record<string, unknown>>;
    gates.securityAudit!.state = 'passed';
    expect(() => parseDeploymentManifest(candidate)).toThrow('passed gate requires evidence');
  });

  it('generates a stable canonical signing payload with signatures removed', () => {
    const manifest = parseDeploymentManifest(completeCandidate());
    expect(JSON.parse(deploymentManifestSigningPayload(manifest))).toMatchObject({ signatures: [] });
    expect(deploymentManifestSigningPayloadHash(manifest)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('validates a complete five-role EIP-191 signature policy', async () => {
    const candidate = completeCandidate();
    const accounts = [1, 2, 3, 4, 5].map((index) => privateKeyToAccount(`0x${index.toString(16).padStart(64, '0')}`));
    const roles = ['security', 'economics', 'legalCompliance', 'operations', 'release'] as const;
    const roleQuorums = {
      economics: { authorizedSigners: [accounts[1]!.address], threshold: 1 },
      legalCompliance: { authorizedSigners: [accounts[2]!.address], threshold: 1 },
      operations: { authorizedSigners: [accounts[3]!.address], threshold: 1 },
      release: { authorizedSigners: [accounts[4]!.address], threshold: 1 },
      security: { authorizedSigners: [accounts[0]!.address], threshold: 1 },
    };
    const policy = {
      authorizedSigners: roles.map((_, index) => accounts[index]!.address),
      policyId: hash(9000),
      roleQuorums,
      threshold: 5,
    };
    candidate.signaturePolicy = policy;
    const unsigned = parseDeploymentManifest(candidate);
    const payloadHash = deploymentManifestSigningPayloadHash(unsigned);
    candidate.signatures = await Promise.all(
      accounts.map(async (account) => ({
        algorithm: 'eip191',
        payloadHash,
        signature: await account.signMessage({ message: { raw: payloadHash } }),
        signer: account.address,
      })),
    );
    await expect(
      validateDeploymentManifest(candidate, {
        kind: 'gumball-6900-release-manifest-signature-policy',
        policyId: hash(9000),
        protocol: 'GUM BALL 6900',
        roleQuorums,
        schemaVersion: 1,
        state: 'configured',
      }),
    ).resolves.toMatchObject({ signaturePolicy: { threshold: 5 } });
  });

  it('blocks a mainnet candidate while the committed signer policy is unresolved', async () => {
    const candidate = unresolvedCandidate();
    (candidate.release as Record<string, unknown>).status = 'mainnet-candidate';
    candidate.network = {
      archiveRpcProviderLabel: 'UNRESOLVED',
      chainId: 4663,
      explorerUrl: 'https://robinhoodchain.blockscout.com',
      name: 'Robinhood Chain',
    };
    await expect(validateDeploymentManifest(candidate)).rejects.toThrow('signature policy is not configured');
  });

  it('validates the committed unresolved draft without a signer policy', async () => {
    await expect(validateDeploymentManifest(draftFixture)).resolves.toMatchObject({ release: { status: 'draft' } });
  });

  it('parses only configured or explicit unresolved trust roots', () => {
    expect(
      parseReleaseManifestSignaturePolicyConfiguration({
        kind: 'gumball-6900-release-manifest-signature-policy',
        protocol: 'GUM BALL 6900',
        schemaVersion: 1,
        state: 'unconfigured',
      }),
    ).toMatchObject({ state: 'unconfigured' });
  });

  it('checks release-observation freshness separately from historical parsing', () => {
    const candidate = completeCandidate();
    candidate.release = {
      createdAt: '2026-08-03T10:00:00Z',
      gitCommit: '1'.repeat(40),
      status: 'release-approved',
      version: 'v1.0.0',
    };
    candidate.releaseEvidence = {
      deploymentConfig: { path: 'evidence/config.json', rawSha256: '1'.repeat(64) },
      deploymentState: { path: 'evidence/state.json', rawSha256: '2'.repeat(64) },
      observation: {
        blockHash: hash(999),
        blockNumber: '1',
        expiresAt: '2026-08-04T10:00:00Z',
        observedAt: '2026-08-03T10:00:00Z',
      },
    };
    const unchecked = candidate as unknown as DeploymentManifest;
    expect(() => assertFreshReleaseEvidence(unchecked, Date.parse('2026-08-03T12:00:00Z'))).not.toThrow();
    expect(() => assertFreshReleaseEvidence(unchecked, Date.parse('2026-08-04T10:00:00Z'))).toThrow('expired');
  });
});
