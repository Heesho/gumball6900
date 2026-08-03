import type { Address } from 'viem';

import type { AssetSymbol, LiveRuntimeDeployment } from '../lib/runtime-types';

export function fixtureAddress(seed: number): Address {
  return `0x${seed.toString(16).padStart(40, '0')}` as Address;
}

const assetRows = [
  ['USDG', 6, 20],
  ['WETH', 18, 21],
  ['WBTC', 8, 22],
  ['QQQ', 18, 23],
  ['TSLA', 18, 24],
  ['SPCX', 18, 25],
  ['NVDA', 18, 26],
  ['AAPL', 18, 27],
  ['GBX', 18, 1],
] as const satisfies readonly [AssetSymbol, number, number][];

export const liveRuntimeFixture = {
  mode: 'live',
  runtimeKind: 'production',
  fallbackReason: null,
  chain: {
    id: 4663,
    environment: 'mainnet',
    name: 'Robinhood Chain',
    rpcUrl: 'https://archive.example/rpc',
    fallbackRpcUrls: ['https://fallback.example/rpc'],
    explorerUrl: 'https://explorer.example',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  issues: [],
  addresses: {
    gbx: fixtureAddress(1),
    protocolTimelock: fixtureAddress(56),
    strategyDeployer: fixtureAddress(60),
    emergencyGuardian: fixtureAddress(55),
    eligibilityModule: fixtureAddress(17),
    genesisBootstrap: fixtureAddress(2),
    genesisClaims: fixtureAddress(3),
    emissionController: fixtureAddress(4),
    miningPool: fixtureAddress(5),
    miningClaims: fixtureAddress(6),
    gumBallVault: fixtureAddress(7),
    assetRegistry: fixtureAddress(8),
    stakedGBX: fixtureAddress(9),
    allocationVoter: fixtureAddress(10),
    revenueRouter: fixtureAddress(11),
    holdUSDGStrategy: fixtureAddress(30),
    buybackBurnStrategy: fixtureAddress(12),
    liquidityManager: fixtureAddress(13),
    launchGuardHook: fixtureAddress(14),
    genesisLiquidityCalculator: fixtureAddress(18),
    gumBallLens: fixtureAddress(15),
    gumBallRouter: fixtureAddress(16),
  },
  assets: Object.fromEntries(assetRows.map(([symbol, , seed]) => [symbol, fixtureAddress(seed)])) as Record<
    AssetSymbol,
    Address
  >,
  assetMetadata: Object.fromEntries(
    assetRows.map(([symbol, decimals, seed]) => [
      symbol,
      {
        symbol,
        address: fixtureAddress(seed),
        decimals,
        uid: null,
        registryStatus: 'NOT_APPLICABLE' as const,
        acquisitionEnabled: symbol !== 'GBX',
        redemptionEnabled: true,
      },
    ]),
  ) as LiveRuntimeDeployment['assetMetadata'],
  strategies: {
    USDG: fixtureAddress(30),
    WETH: fixtureAddress(31),
    WBTC: fixtureAddress(32),
    QQQ: fixtureAddress(33),
    TSLA: fixtureAddress(34),
    SPCX: fixtureAddress(35),
    NVDA: fixtureAddress(36),
    AAPL: fixtureAddress(37),
    BURN: fixtureAddress(12),
  },
  rewards: {
    WETH: fixtureAddress(41),
    WBTC: fixtureAddress(42),
    QQQ: fixtureAddress(43),
    TSLA: fixtureAddress(44),
    SPCX: fixtureAddress(45),
    NVDA: fixtureAddress(46),
    AAPL: fixtureAddress(47),
  },
  externalContracts: {
    poolManager: { address: fixtureAddress(50), sourceUrl: 'https://example.com', verifiedAtBlock: '1' },
    positionManager: { address: fixtureAddress(59), sourceUrl: 'https://example.com', verifiedAtBlock: '1' },
    quoter: { address: fixtureAddress(51), sourceUrl: 'https://example.com', verifiedAtBlock: '1' },
    stateView: { address: fixtureAddress(52), sourceUrl: 'https://example.com', verifiedAtBlock: '1' },
    universalRouter: { address: fixtureAddress(53), sourceUrl: 'https://example.com', verifiedAtBlock: '1' },
    permit2: { address: fixtureAddress(54), sourceUrl: 'https://example.com', verifiedAtBlock: '1' },
  },
  admin: {
    emergencyGuardian: fixtureAddress(55),
    protocolTimelock: fixtureAddress(56),
    guardianOperator: fixtureAddress(57),
    protocolTimelockProposer: fixtureAddress(58),
  },
  subgraphUrl: 'https://subgraph.example/graphql',
  manifest: {
    version: 'v1.0.0',
    gitCommit: 'a'.repeat(40),
    status: 'release-approved',
    complianceMode: 'permissioned-production',
    miningPoolDeploymentBlock: '13',
    signatureCount: 2,
    signatureThreshold: 2,
  },
} as const satisfies LiveRuntimeDeployment;
