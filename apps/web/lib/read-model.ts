import { parseUnitsExact } from './format';

export type AssetStatus = 'active' | 'halted' | 'watch';
export type ActivityKind =
  | 'Mining'
  | 'Claim'
  | 'Signal'
  | 'Acquisition'
  | 'Reward'
  | 'Redemption'
  | 'Buyback'
  | 'Burn'
  | 'Liquidity';

export interface VaultAssetReadModel {
  symbol: string;
  name: string;
  color: string;
  rawBalance: bigint;
  uiAdjustedBalance: bigint;
  displayValueUSDG: bigint;
  displayShareBps: bigint;
  signalWeightBps: bigint;
  pendingBudgetUSDG: bigint;
  multiplierWad: bigint;
  pendingMultiplierWad?: bigint;
  pendingMultiplierAt?: string;
  registryStatus: AssetStatus;
  tradingHalted: boolean;
  recentFill: string;
}

export interface SignalReadModel {
  symbol: string;
  label: string;
  color: string;
  activeBps: bigint;
  pendingBps?: bigint;
  budgetUSDG: bigint;
}

export interface ActivityReadModel {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  amount: string;
  time: string;
  tone: 'cyan' | 'pink' | 'blue' | 'gold' | 'neutral';
}

export interface StrategyFillReadModel {
  id: string;
  symbol: string;
  color: string;
  usdSpent: bigint;
  targetReceived: bigint;
  vaultReceived: bigint;
  managerReceived: bigint;
  settled: string;
}

export const protocolSnapshot = {
  cumulativeMinted: parseUnitsExact('243193226.271656901106056396'),
  cumulativeBurned: parseUnitsExact('3892410.42'),
  totalSupply: parseUnitsExact('239300815.851656901106056396'),
  scheduledEmission: parseUnitsExact('359215.052833650539558316'),
  newEmission24h: parseUnitsExact('285900'),
  burned24h: parseUnitsExact('112940'),
  vaultDisplayValueUSDG: parseUnitsExact('18942880'),
  buybackBurnedAllTime: parseUnitsExact('3218040.16'),
  buybackUSDGAllTime: parseUnitsExact('6881942.27'),
  liquidityDisplayValueUSDG: parseUnitsExact('9321480'),
  activeManagers: 1842,
} as const;

export const miningEpoch = {
  id: 418,
  endsInSeconds: 6 * 3_600 + 42 * 60,
  extensionSeconds: 15 * 60,
  totalUSDG: parseUnitsExact('586095'),
  userUSDG: parseUnitsExact('1250'),
  estimatedUserGBX: parseUnitsExact('609.756097560975609756'),
  scheduledEmission: protocolSnapshot.scheduledEmission,
  estimatedActualEmission: parseUnitsExact('285900'),
  minimumMiningPrice: parseUnitsExact('2.05'),
  estimatedClearingPrice: parseUnitsExact('2.05'),
  referenceMiningPrice: parseUnitsExact('2.157894736842105263'),
  fundingBps: 7_959n,
} as const;

export const vaultAssets: readonly VaultAssetReadModel[] = [
  {
    symbol: 'USDG',
    name: 'Global Dollar',
    color: '#67f5e4',
    rawBalance: parseUnitsExact('4167433.6'),
    uiAdjustedBalance: parseUnitsExact('4167433.6'),
    displayValueUSDG: parseUnitsExact('4167433.6'),
    displayShareBps: 2_200n,
    signalWeightBps: 1_800n,
    pendingBudgetUSDG: parseUnitsExact('941220'),
    multiplierWad: parseUnitsExact('1'),
    registryStatus: 'active',
    tradingHalted: false,
    recentFill: 'Held in vault',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    color: '#8ba8ff',
    rawBalance: parseUnitsExact('1032.447'),
    uiAdjustedBalance: parseUnitsExact('1032.447'),
    displayValueUSDG: parseUnitsExact('3409718.4'),
    displayShareBps: 1_800n,
    signalWeightBps: 1_600n,
    pendingBudgetUSDG: parseUnitsExact('836640'),
    multiplierWad: parseUnitsExact('1'),
    registryStatus: 'active',
    tradingHalted: false,
    recentFill: '184.2 WETH · 2h ago',
  },
  {
    symbol: 'WBTC',
    name: 'Canonical Wrapped BTC',
    color: '#f5bd62',
    rawBalance: parseUnitsExact('31.2849'),
    uiAdjustedBalance: parseUnitsExact('31.2849'),
    displayValueUSDG: parseUnitsExact('3125560.2'),
    displayShareBps: 1_650n,
    signalWeightBps: 1_300n,
    pendingBudgetUSDG: parseUnitsExact('679770'),
    multiplierWad: parseUnitsExact('1'),
    registryStatus: 'active',
    tradingHalted: false,
    recentFill: '4.82 WBTC · 5h ago',
  },
  {
    symbol: 'QQQ',
    name: 'QQQ Robinhood Token',
    color: '#c78cff',
    rawBalance: parseUnitsExact('4297.128'),
    uiAdjustedBalance: parseUnitsExact('4297.128'),
    displayValueUSDG: parseUnitsExact('2367860'),
    displayShareBps: 1_250n,
    signalWeightBps: 1_100n,
    pendingBudgetUSDG: parseUnitsExact('575190'),
    multiplierWad: parseUnitsExact('1'),
    registryStatus: 'active',
    tradingHalted: false,
    recentFill: '802.4 QQQ · 7h ago',
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Robinhood Token',
    color: '#ff769f',
    rawBalance: parseUnitsExact('6120.55'),
    uiAdjustedBalance: parseUnitsExact('6120.55'),
    displayValueUSDG: parseUnitsExact('1704860'),
    displayShareBps: 900n,
    signalWeightBps: 900n,
    pendingBudgetUSDG: parseUnitsExact('470610'),
    multiplierWad: parseUnitsExact('1'),
    registryStatus: 'watch',
    tradingHalted: true,
    recentFill: '1,220 TSLA · 11h ago',
  },
  {
    symbol: 'SPCX',
    name: 'SpaceX Robinhood Token',
    color: '#8de0ff',
    rawBalance: parseUnitsExact('7984.1'),
    uiAdjustedBalance: parseUnitsExact('7984.1'),
    displayValueUSDG: parseUnitsExact('1136572.8'),
    displayShareBps: 600n,
    signalWeightBps: 700n,
    pendingBudgetUSDG: parseUnitsExact('366030'),
    multiplierWad: parseUnitsExact('1'),
    registryStatus: 'active',
    tradingHalted: false,
    recentFill: '940 SPCX · 1d ago',
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Robinhood Token',
    color: '#a8ef72',
    rawBalance: parseUnitsExact('10284.442'),
    uiAdjustedBalance: parseUnitsExact('20568.884'),
    displayValueUSDG: parseUnitsExact('1799573.6'),
    displayShareBps: 950n,
    signalWeightBps: 1_000n,
    pendingBudgetUSDG: parseUnitsExact('522900'),
    multiplierWad: parseUnitsExact('2'),
    pendingMultiplierWad: parseUnitsExact('4'),
    pendingMultiplierAt: 'Aug 08, 2026 · 13:30 UTC',
    registryStatus: 'active',
    tradingHalted: false,
    recentFill: '2,104 NVDA · 3h ago',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Robinhood Token',
    color: '#dce3e3',
    rawBalance: parseUnitsExact('5102.3'),
    uiAdjustedBalance: parseUnitsExact('5102.3'),
    displayValueUSDG: parseUnitsExact('1231301.4'),
    displayShareBps: 650n,
    signalWeightBps: 600n,
    pendingBudgetUSDG: parseUnitsExact('313740'),
    multiplierWad: parseUnitsExact('1'),
    registryStatus: 'active',
    tradingHalted: false,
    recentFill: '882 AAPL · 9h ago',
  },
] as const;

export const signalAllocations: readonly SignalReadModel[] = [
  { symbol: 'USDG', label: 'Hold USDG', color: '#67f5e4', activeBps: 1_800n, budgetUSDG: parseUnitsExact('941220') },
  {
    symbol: 'WETH',
    label: 'Accumulate WETH',
    color: '#8ba8ff',
    activeBps: 1_600n,
    pendingBps: 1_400n,
    budgetUSDG: parseUnitsExact('836640'),
  },
  {
    symbol: 'WBTC',
    label: 'Accumulate WBTC',
    color: '#f5bd62',
    activeBps: 1_300n,
    budgetUSDG: parseUnitsExact('679770'),
  },
  {
    symbol: 'QQQ',
    label: 'Accumulate QQQ',
    color: '#c78cff',
    activeBps: 1_100n,
    pendingBps: 1_300n,
    budgetUSDG: parseUnitsExact('575190'),
  },
  {
    symbol: 'TSLA',
    label: 'Accumulate TSLA',
    color: '#ff769f',
    activeBps: 900n,
    budgetUSDG: parseUnitsExact('470610'),
  },
  {
    symbol: 'SPCX',
    label: 'Accumulate SPCX',
    color: '#8de0ff',
    activeBps: 700n,
    budgetUSDG: parseUnitsExact('366030'),
  },
  {
    symbol: 'NVDA',
    label: 'Accumulate NVDA',
    color: '#a8ef72',
    activeBps: 1_000n,
    pendingBps: 1_200n,
    budgetUSDG: parseUnitsExact('522900'),
  },
  {
    symbol: 'AAPL',
    label: 'Accumulate AAPL',
    color: '#dce3e3',
    activeBps: 600n,
    budgetUSDG: parseUnitsExact('313740'),
  },
  {
    symbol: 'BURN',
    label: 'Buy back + burn GBX',
    color: '#ff6ca3',
    activeBps: 1_000n,
    pendingBps: 800n,
    budgetUSDG: parseUnitsExact('522900'),
  },
] as const;

export const userSignalAccount = {
  walletGBX: parseUnitsExact('148220.44'),
  stakedGBX: parseUnitsExact('92000'),
  unallocatedSGBX: parseUnitsExact('8000'),
  pendingActivatesInSeconds: 19 * 3_600 + 42 * 60,
  allocations: [
    { symbol: 'WETH', activeBps: 3_500n, pendingBps: 3_000n, color: '#8ba8ff' },
    { symbol: 'QQQ', activeBps: 2_500n, pendingBps: 3_000n, color: '#c78cff' },
    { symbol: 'NVDA', activeBps: 2_000n, pendingBps: 2_500n, color: '#a8ef72' },
    { symbol: 'BURN', activeBps: 2_000n, pendingBps: 1_500n, color: '#ff6ca3' },
  ],
  rewards: [
    { symbol: 'WETH', amount: parseUnitsExact('0.1942'), color: '#8ba8ff' },
    { symbol: 'QQQ', amount: parseUnitsExact('3.82'), color: '#c78cff' },
    { symbol: 'NVDA', amount: parseUnitsExact('9.41'), color: '#a8ef72' },
  ],
} as const;

export const strategyFills: readonly StrategyFillReadModel[] = [
  {
    id: 'nvda-184',
    symbol: 'NVDA',
    color: '#a8ef72',
    usdSpent: parseUnitsExact('42000'),
    targetReceived: parseUnitsExact('231.84'),
    vaultReceived: parseUnitsExact('227.2032'),
    managerReceived: parseUnitsExact('4.6368'),
    settled: '3 min ago',
  },
  {
    id: 'weth-183',
    symbol: 'WETH',
    color: '#8ba8ff',
    usdSpent: parseUnitsExact('41000'),
    targetReceived: parseUnitsExact('12.8405'),
    vaultReceived: parseUnitsExact('12.58369'),
    managerReceived: parseUnitsExact('0.25681'),
    settled: '2h ago',
  },
  {
    id: 'qqq-182',
    symbol: 'QQQ',
    color: '#c78cff',
    usdSpent: parseUnitsExact('42750'),
    targetReceived: parseUnitsExact('802.4'),
    vaultReceived: parseUnitsExact('786.352'),
    managerReceived: parseUnitsExact('16.048'),
    settled: '7h ago',
  },
] as const;

export const redemptionPreview = {
  shares: parseUnitsExact('10000'),
  supplyBefore: protocolSnapshot.totalSupply,
  assets: vaultAssets.map((asset) => ({
    symbol: asset.symbol,
    color: asset.color,
    rawAmount: (asset.rawBalance * parseUnitsExact('10000')) / protocolSnapshot.totalSupply,
    uiAdjustedAmount: (asset.uiAdjustedBalance * parseUnitsExact('10000')) / protocolSnapshot.totalSupply,
  })),
} as const;

export const liquidityPool = {
  poolId: '0x7e91…69a0',
  feeBps: 30n,
  tickSpacing: 60,
  currentTick: -194_820,
  displayPriceUSDG: parseUnitsExact('2.3274'),
  gbxInventory: parseUnitsExact('12680440'),
  usdgInventory: parseUnitsExact('9321480'),
  feesUSDG: parseUnitsExact('186402.31'),
  feesGBXBurned: parseUnitsExact('88411.72'),
  owner: 'LiquidityManager',
  positions: [
    {
      id: '#01',
      allocationBps: 5_000n,
      range: '1.00× – 1.50× P₀',
      composition: '63% GBX / 37% USDG',
      status: 'active',
    },
    { id: '#02', allocationBps: 3_000n, range: '1.50× – 3.00× P₀', composition: '100% GBX', status: 'waiting' },
    { id: '#03', allocationBps: 1_500n, range: '3.00× – 6.00× P₀', composition: '100% GBX', status: 'waiting' },
    { id: '#04', allocationBps: 500n, range: '6.00× – 12.00× P₀', composition: '100% GBX', status: 'waiting' },
  ],
} as const;

export const recentActivity: readonly ActivityReadModel[] = [
  {
    id: 'a1',
    kind: 'Acquisition',
    title: 'NVDA strategy filled',
    detail: '42,000 USDG lot · auction #184',
    amount: '+231.84 NVDA',
    time: '3 min ago',
    tone: 'cyan',
  },
  {
    id: 'a2',
    kind: 'Mining',
    title: 'Epoch 417 settled',
    detail: '842 contributors · 2.05 USDG clearing price',
    amount: '+286.2K GBX',
    time: '38 min ago',
    tone: 'blue',
  },
  {
    id: 'a3',
    kind: 'Buyback',
    title: 'GBX bought and burned',
    detail: '25,000 USDG lot · real supply burn',
    amount: '−12,118 GBX',
    time: '1h ago',
    tone: 'pink',
  },
  {
    id: 'a4',
    kind: 'Reward',
    title: 'Manager rewards notified',
    detail: 'WETH strategy · active signalers only',
    amount: '+0.842 WETH',
    time: '2h ago',
    tone: 'gold',
  },
  {
    id: 'a5',
    kind: 'Redemption',
    title: 'Basket redeemed',
    detail: '8 assets delivered in kind',
    amount: '−82,000 GBX',
    time: '3h ago',
    tone: 'neutral',
  },
  {
    id: 'a6',
    kind: 'Liquidity',
    title: 'Protocol fees collected',
    detail: 'USDG routed to vault · GBX burned',
    amount: '+18,420 USDG',
    time: '5h ago',
    tone: 'cyan',
  },
] as const;

export const claimableEpochs = [
  {
    epoch: 417,
    contributed: parseUnitsExact('920'),
    claimable: parseUnitsExact('448.78048780487804878'),
    settled: 'Jul 31, 2026',
  },
  {
    epoch: 414,
    contributed: parseUnitsExact('300'),
    claimable: parseUnitsExact('143.541178'),
    settled: 'Jul 28, 2026',
  },
] as const;

export const adminOperations = [
  { label: 'New mining contributions', status: 'Preview enabled', action: 'Pause', delay: 'Guardian immediate' },
  { label: 'Acquisition strategy fills', status: 'Preview enabled', action: 'Pause', delay: 'Guardian immediate' },
  { label: 'TSLA acquisition', status: 'Preview watch', action: 'Disable', delay: 'Guardian immediate' },
  { label: 'Stale WBTC reference rate', status: 'Preview review', action: 'Queue reset', delay: '48h timelock' },
  {
    label: 'Matured timelock action',
    status: 'Preview none queued',
    action: 'Execute matured',
    delay: 'Only after ETA',
  },
  {
    label: 'Canonical liquidity migration',
    status: 'Preview none queued',
    action: 'Review',
    delay: '7d timelock',
  },
] as const;
