import { expect } from 'chai';
import { Interface, id } from 'ethers';

import type { DeploymentConfig, DeploymentState } from '../../../script/hardhat/deployment';
import {
  assertObservedGenesisLiquidity,
  assertObservedGenesisSettlementTransaction,
  expectedGenesisSqrtPriceX96,
  genesisPositionPrincipal,
  positionInfoTicks,
  sqrtPriceX96AtTick,
  type ObservedGenesisLiquidity,
  type ObservedGenesisPosition,
  type ObservedPoolKey,
} from '../../../script/hardhat/genesis-liquidity-verification';

const address = (value: number): string => `0x${value.toString(16).padStart(40, '0')}`;
const bytes32 = (value: number): string => `0x${value.toString(16).padStart(64, '0')}`;
const GBX = address(1);
const USDG = address(2);
const POOL_MANAGER = address(30);
const POSITION_MANAGER = address(31);
const PERMIT2 = address(32);
const LIQUIDITY_MANAGER = address(40);
const LAUNCH_GUARD_HOOK = address(41);
const COMMUNITY_USDG = 80_000_000n * 10n ** 18n;
const POSITION_CAP = (20_000_000n * 10n ** 18n) / 4n;
const Q96 = 1n << 96n;
const MAX_UINT128 = (1n << 128n) - 1n;

function canonicalTokenDependencies(): NonNullable<DeploymentConfig['canonicalTokenDependencies']> {
  const weth = address(70);
  const admin = address(73);
  return {
    usdG: {
      address: USDG,
      proxyEvidence: {
        adminSlotValue: bytes32(0),
        implementationAddress: address(61),
        implementationRuntimeBytecodeHash: bytes32(61),
        kind: 'eip1967-uups',
        upgradeAuthorityAddress: address(62),
        upgradeAuthorityRuntimeBytecodeHash: bytes32(62),
      },
      runtimeBytecodeHash: bytes32(60),
    },
    weth: {
      address: weth,
      proxyEvidence: {
        adminAddress: admin,
        adminOwnerAddress: address(74),
        adminOwnerProxyEvidence: {
          adminSlotValue: bytes32(0),
          implementationAddress: address(75),
          implementationRuntimeBytecodeHash: bytes32(75),
        },
        adminOwnerRuntimeBytecodeHash: bytes32(74),
        adminRuntimeBytecodeHash: bytes32(73),
        adminSlotValue: `0x${'00'.repeat(12)}${admin.slice(2)}`,
        implementationAddress: address(71),
        implementationRuntimeBytecodeHash: bytes32(71),
        kind: 'eip1967-transparent',
        proxyAdminInterface: 'oz-v4',
      },
      runtimeBytecodeHash: bytes32(70),
    },
  };
}

function packTicks(tickLower: bigint, tickUpper: bigint): bigint {
  const mask = 0xff_ffffn;
  return ((tickLower & mask) << 8n) | ((tickUpper & mask) << 32n);
}

function deploymentConfig(): DeploymentConfig {
  return {
    assetReview: {
      path: 'packages/config/deployments/robinhood-mainnet-assets.2026-08-01.candidate.json',
      rawSha256: '1'.repeat(64),
    },
    assets: {
      assetIds: [id('WETH')],
      decimals: [18],
      initialReferenceRates: ['1'],
      isStockToken: [false],
      runtimeBytecodeHashes: [bytes32(70)],
      symbolHashes: [id('WETH')],
      tokens: [address(70)],
      uiMultipliers: [null],
    },
    canonicalTokenDependencies: canonicalTokenDependencies(),
    emergencyGuardianSafe: {
      enabledModules: [],
      fallbackHandler: address(0),
      guard: address(0),
      owners: [address(64), address(65)],
      proxyRuntimeBytecodeHash: bytes32(64),
      safeAddress: address(52),
      singletonAddress: address(66),
      singletonRuntimeBytecodeHash: bytes32(66),
      threshold: '2',
    },
    eligibility: { mode: 1, module: address(50), registry: address(51) },
    genesis: { bootstrapContributionCap: COMMUNITY_USDG.toString(), minimumBootstrapUSDG: '1' },
    kind: 'gumball-6900-deployment-config',
    liquidity: {
      mode: 'unrestricted-test',
      permissionedDependencies: null,
      allocationBps: [2500, 2500, 2500, 2500],
      cumulativeTickDeltas: [60, 120, 180, 240],
      poolFee: 3000,
      tickSpacing: 60,
    },
    network: { chainId: 4_663, name: 'Robinhood Chain' },
    protocol: 'GUM BALL 6900',
    protocolAdminSafe: {
      enabledModules: [],
      fallbackHandler: address(0),
      guard: address(0),
      owners: [address(55), address(56)],
      proxyRuntimeBytecodeHash: bytes32(62),
      safeAddress: address(54),
      singletonAddress: address(57),
      singletonRuntimeBytecodeHash: bytes32(63),
      threshold: '2',
    },
    roles: {
      emergencyGuardianOperator: address(52),
      genesisLiquidityBacker: address(53),
      protocolTimelockMultisig: address(54),
    },
    schemaVersion: 1,
    stockTokenDependency: {
      beaconAddress: address(60),
      beaconRuntimeBytecodeHash: bytes32(60),
      implementationAddress: address(61),
      implementationRuntimeBytecodeHash: bytes32(61),
    },
    wrappedBtcBridgeDependency: null,
    strategies: {
      buybackInitialReferenceRate: '1',
      maximumLotUSDG: '1',
      minimumLotUSDG: '1',
    },
    uniswapV4: { permit2: PERMIT2, poolManager: POOL_MANAGER, positionManager: POSITION_MANAGER },
    usdG: USDG,
    usdGDecimals: 18,
  };
}

function deploymentState(): DeploymentState {
  return {
    addresses: {
      acquisitionStrategies: [],
      allocationVoter: address(103),
      assetRegistry: address(104),
      buybackBurnStrategy: address(105),
      eligibilityAllowlistChecker: address(126),
      permissionedPoolController: address(127),
      gbxPermissionsAdapter: address(128),
      adapterVerificationEscrow: address(129),
      eligibilityModule: address(106),
      emergencyGuardian: address(107),
      emissionController: address(108),
      gbx: GBX,
      strategyDeployer: address(199),
      genesisBootstrap: address(109),
      genesisClaims: address(110),
      genesisLiquidityCalculator: address(111),
      gumBallRouter: address(112),
      gumBallVault: address(113),
      holdUSDGStrategy: address(114),
      launchGuardHook: LAUNCH_GUARD_HOOK,
      lens: address(115),
      liquidityManager: LIQUIDITY_MANAGER,
      managerRewards: [],
      miningClaims: address(116),
      miningPool: address(117),
      protocolTimelock: address(118),
      revenueRouter: address(119),
      stakedGBX: address(120),
    },
    chainId: '4663',
    configHash: bytes32(1),
    contracts: [],
    dependencyInitializer: address(121),
    gbxContractHolders: [],
    hookSalt: bytes32(2),
    networkName: 'Robinhood Chain',
    phase: 'GENESIS_SETTLED',
    schemaVersion: 1,
    timelockOperations: [],
    transactions: {},
    updatedAt: '2026-08-01T00:00:00Z',
  };
}

function poolKey(): ObservedPoolKey {
  return {
    currency0: GBX,
    currency1: USDG,
    fee: 3000n,
    hooks: LAUNCH_GUARD_HOOK,
    tickSpacing: 60n,
  };
}

function position(index: number): ObservedGenesisPosition {
  const tickLower = BigInt(index * 60);
  const tickUpper = BigInt((index + 1) * 60);
  let lower = 0n;
  let upper = MAX_UINT128;
  while (lower < upper) {
    const middle = lower + (upper - lower + 1n) / 2n;
    if (genesisPositionPrincipal(tickLower, tickUpper, middle, true) <= POSITION_CAP) lower = middle;
    else upper = middle - 1n;
  }
  const principal = genesisPositionPrincipal(tickLower, tickUpper, lower, true);
  return {
    exists: true,
    gbxPrincipal: principal,
    liquidity: lower,
    owner: LIQUIDITY_MANAGER,
    packedPositionInfo: packTicks(tickLower, tickUpper),
    poolKey: poolKey(),
    positionId: 100n + BigInt(index),
    storedLiquidity: lower,
    tickLower,
    tickUpper,
  };
}

function observed(): ObservedGenesisLiquidity {
  const positions = [position(0), position(1), position(2), position(3)];
  const genesisPrincipal = positions.reduce((total, entry) => total + entry.gbxPrincipal, 0n);
  return {
    activePositionCount: 4n,
    communityUsdG: COMMUNITY_USDG,
    genesisPrincipal,
    genesisSqrtPriceX96: Q96,
    genesisTick: 0n,
    maxActivePositions: 16n,
    poolManagerGbxBalance: genesisPrincipal,
    poolSqrtPriceX96: Q96,
    poolTick: 0n,
    positionManagerPermit2: PERMIT2,
    positionManagerPoolManager: POOL_MANAGER,
    positions,
    requiredSponsorUsdG: COMMUNITY_USDG / 4n,
    stateViewPoolManager: POOL_MANAGER,
    vaultUsdGBalance: COMMUNITY_USDG + COMMUNITY_USDG / 4n,
  };
}

describe('Genesis liquidity release verification', function () {
  it('accepts the independently priced, exact four-position one-sided ladder', function () {
    expect(expectedGenesisSqrtPriceX96(GBX, USDG, COMMUNITY_USDG)).to.equal(Q96);
    expect(sqrtPriceX96AtTick(0n)).to.equal(Q96);
    expect(() => assertObservedGenesisLiquidity(observed(), deploymentConfig(), deploymentState())).not.to.throw();
  });

  it('binds the recorded settlement calldata to the official SDK witness and finalized raise', function () {
    const state = deploymentState();
    const hash = bytes32(6900);
    state.transactions['genesis:settle'] = { blockNumber: 123, hash };
    const data = new Interface(['function settle(uint160 sqrtPriceX96)']).encodeFunctionData('settle', [Q96]);
    const actual = {
      blockNumber: 123,
      data,
      hash,
      receiptBlockNumber: 123,
      receiptHash: hash,
      receiptStatus: 1,
      to: state.addresses.genesisBootstrap,
      value: 0n,
    };

    expect(() =>
      assertObservedGenesisSettlementTransaction(actual, state, deploymentConfig(), COMMUNITY_USDG, 124n),
    ).not.to.throw();

    expect(() =>
      assertObservedGenesisSettlementTransaction(
        {
          ...actual,
          data: new Interface(['function settle(uint160 sqrtPriceX96)']).encodeFunctionData('settle', [Q96 + 1n]),
        },
        state,
        deploymentConfig(),
        COMMUNITY_USDG,
        124n,
      ),
    ).to.throw('official-SDK-derived price witness');

    expect(() =>
      assertObservedGenesisSettlementTransaction(actual, state, deploymentConfig(), COMMUNITY_USDG / 4n, 124n),
    ).to.throw('official-SDK-derived price witness');
  });

  it('rejects missing or unsuccessful settlement transaction provenance', function () {
    const state = deploymentState();
    const hash = bytes32(6901);
    const actual = {
      blockNumber: 123,
      data: new Interface(['function settle(uint160 sqrtPriceX96)']).encodeFunctionData('settle', [Q96]),
      hash,
      receiptBlockNumber: 123,
      receiptHash: hash,
      receiptStatus: 1,
      to: state.addresses.genesisBootstrap,
      value: 0n,
    };
    expect(() =>
      assertObservedGenesisSettlementTransaction(actual, state, deploymentConfig(), COMMUNITY_USDG, 124n),
    ).to.throw('lacks deployment-state transaction provenance');

    state.transactions['genesis:settle'] = { blockNumber: 123, hash };
    expect(() =>
      assertObservedGenesisSettlementTransaction(
        { ...actual, receiptStatus: 0 },
        state,
        deploymentConfig(),
        COMMUNITY_USDG,
        124n,
      ),
    ).to.throw('does not match deployment state');
  });

  it('rejects active-position cap or genesis counter drift', function () {
    const wrongCap = observed();
    wrongCap.maxActivePositions = 17n;
    expect(() => assertObservedGenesisLiquidity(wrongCap, deploymentConfig(), deploymentState())).to.throw(
      'active-position cap',
    );

    const wrongCount = observed();
    wrongCount.activePositionCount = 3n;
    expect(() => assertObservedGenesisLiquidity(wrongCount, deploymentConfig(), deploymentState())).to.throw(
      'active-position count',
    );
  });

  it('decodes signed PositionInfo ticks and rejects an internally consistent wrong ladder', function () {
    expect(positionInfoTicks(packTicks(-120n, -60n))).to.deep.equal({ tickLower: -120n, tickUpper: -60n });

    const wrong = observed();
    wrong.positions[0]!.tickLower = 60n;
    wrong.positions[0]!.tickUpper = 120n;
    wrong.positions[0]!.packedPositionInfo = packTicks(60n, 120n);
    expect(() => assertObservedGenesisLiquidity(wrong, deploymentConfig(), deploymentState())).to.throw(
      'ticks do not match the canonical one-sided genesis ladder',
    );
  });

  it('rejects NFT ownership and canonical external-wiring substitutions', function () {
    const owner = observed();
    owner.positions[0]!.owner = address(999);
    expect(() => assertObservedGenesisLiquidity(owner, deploymentConfig(), deploymentState())).to.throw('owner');

    const stateView = observed();
    stateView.stateViewPoolManager = address(999);
    expect(() => assertObservedGenesisLiquidity(stateView, deploymentConfig(), deploymentState())).to.throw(
      'StateView canonical PoolManager',
    );
  });

  it('rejects vault and PoolManager custody deficits', function () {
    const poolCustody = observed();
    poolCustody.poolManagerGbxBalance -= 1n;
    expect(() => assertObservedGenesisLiquidity(poolCustody, deploymentConfig(), deploymentState())).to.throw(
      'PoolManager GBX custody',
    );

    const vaultCustody = observed();
    vaultCustody.vaultUsdGBalance -= 1n;
    expect(() => assertObservedGenesisLiquidity(vaultCustody, deploymentConfig(), deploymentState())).to.throw(
      'GumBallVault USDG custody',
    );
  });

  it('rejects a mutually consistent but non-endogenous pool price', function () {
    const wrong = observed();
    wrong.genesisSqrtPriceX96 += 1n;
    wrong.poolSqrtPriceX96 += 1n;
    expect(() => assertObservedGenesisLiquidity(wrong, deploymentConfig(), deploymentState())).to.throw(
      'does not match the endogenous community clearing ratio',
    );
  });

  it('rejects zero principal and nonconsecutive genesis position IDs', function () {
    const zeroPrincipal = observed();
    zeroPrincipal.positions[0]!.gbxPrincipal = 0n;
    expect(() => assertObservedGenesisLiquidity(zeroPrincipal, deploymentConfig(), deploymentState())).to.throw(
      'zero recorded GBX principal',
    );

    const skippedId = observed();
    skippedId.positions[2]!.positionId += 10n;
    expect(() => assertObservedGenesisLiquidity(skippedId, deploymentConfig(), deploymentState())).to.throw(
      'not part of the consecutive genesis mint',
    );
  });

  it('independently rejects misstated principal and non-maximal external liquidity', function () {
    const misstatedPrincipal = observed();
    misstatedPrincipal.positions[0]!.gbxPrincipal += 1n;
    expect(() => assertObservedGenesisLiquidity(misstatedPrincipal, deploymentConfig(), deploymentState())).to.throw(
      'recorded GBX principal does not match v4 rounded-up liquidity math',
    );

    const nonMaximal = observed();
    const target = nonMaximal.positions[0]!;
    target.liquidity -= 1n;
    target.storedLiquidity = target.liquidity;
    target.gbxPrincipal = genesisPositionPrincipal(target.tickLower, target.tickUpper, target.liquidity, true);
    nonMaximal.genesisPrincipal = nonMaximal.positions.reduce((total, entry) => total + entry.gbxPrincipal, 0n);
    nonMaximal.poolManagerGbxBalance = nonMaximal.genesisPrincipal;
    expect(() => assertObservedGenesisLiquidity(nonMaximal, deploymentConfig(), deploymentState())).to.throw(
      'PositionManager liquidity is not maximal for its genesis allocation cap',
    );
  });
});
