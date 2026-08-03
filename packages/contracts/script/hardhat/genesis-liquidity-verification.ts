import { AbiCoder, Contract, Interface, ZeroAddress, getAddress, keccak256 } from 'ethers';
import type { Provider } from 'ethers';
import { encodeSqrtRatioX96, TickMath } from '@uniswap/v3-sdk';

import type { DeploymentConfig, DeploymentState } from './deployment';
import type { ReleaseManifest } from './release-manifest-binding';

const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'] as const;

const BOOTSTRAP_BACKING_ABI = [
  'function communityUSDG() view returns (uint256)',
  'function requiredSponsorUSDG() view returns (uint256)',
] as const;

const LIQUIDITY_MANAGER_GENESIS_ABI = [
  'function genesisSqrtPriceX96() view returns (uint160)',
  'function genesisTick() view returns (int24)',
  'function genesisLiquidityPrincipal() view returns (uint256)',
  'function MAX_ACTIVE_POSITIONS() view returns (uint256)',
  'function activePositionCount() view returns (uint256)',
  'function poolKey() view returns (tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks))',
  'function positionIds(uint256) view returns (uint256)',
  'function positionRecord(uint256) view returns (int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 gbxPrincipal,bool exists)',
] as const;

const POSITION_MANAGER_GENESIS_ABI = [
  'function permit2() view returns (address)',
  'function poolManager() view returns (address)',
  'function ownerOf(uint256) view returns (address)',
  'function getPoolAndPositionInfo(uint256) view returns (tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),uint256)',
  'function getPositionLiquidity(uint256) view returns (uint128)',
] as const;

const STATE_VIEW_ABI = [
  'function poolManager() view returns (address)',
  'function getSlot0(bytes32) view returns (uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)',
] as const;

const GENESIS_MINER_ALLOCATION = 80_000_000n * 10n ** 18n;
const GENESIS_LIQUIDITY_ALLOCATION = 20_000_000n * 10n ** 18n;
const MAX_ACTIVE_LIQUIDITY_POSITIONS = 16n;
const MAX_UINT128 = (1n << 128n) - 1n;
const MIN_TICK = BigInt(TickMath.MIN_TICK);
const MAX_TICK = BigInt(TickMath.MAX_TICK);

export interface ObservedPoolKey {
  currency0: string;
  currency1: string;
  fee: bigint;
  hooks: string;
  tickSpacing: bigint;
}

export interface ObservedGenesisPosition {
  exists: boolean;
  gbxPrincipal: bigint;
  liquidity: bigint;
  owner: string;
  packedPositionInfo: bigint;
  poolKey: ObservedPoolKey;
  positionId: bigint;
  storedLiquidity: bigint;
  tickLower: bigint;
  tickUpper: bigint;
}

export interface ObservedGenesisLiquidity {
  activePositionCount: bigint;
  adapterUnderlyingBalance?: bigint;
  adapterTotalSupply?: bigint;
  communityUsdG: bigint;
  genesisPrincipal: bigint;
  genesisSqrtPriceX96: bigint;
  genesisTick: bigint;
  maxActivePositions: bigint;
  poolManagerGbxBalance: bigint;
  poolSqrtPriceX96: bigint;
  poolTick: bigint;
  positionManagerPermit2: string;
  positionManagerPoolManager: string;
  permissionedBootstrapEnableConsumed?: boolean;
  permissionedSwappingEnabled?: boolean;
  positions: ObservedGenesisPosition[];
  requiredSponsorUsdG: bigint;
  stateViewPoolManager: string;
  vaultUsdGBalance: bigint;
}

/** Returns the actual v4 pool currency: underlying GBX for test graphs, or its verified adapter in production. */
export function poolFacingGBXCurrency(config: DeploymentConfig, state: DeploymentState): string {
  const currency =
    config.liquidity.mode === 'permissioned' ? state.addresses.gbxPermissionsAdapter : state.addresses.gbx;
  const canonicalCurrency = getAddress(currency);
  if (canonicalCurrency === ZeroAddress) throw new Error('pool-facing GBX currency is not bound in deployment state');
  return canonicalCurrency;
}

function equalAddress(actual: string, expected: string, label: string): void {
  if (getAddress(actual) !== getAddress(expected)) throw new Error(`${label}: ${actual} != ${expected}`);
}

function signedInt24(packed: bigint, offset: bigint): bigint {
  const raw = (packed >> offset) & 0xff_ffffn;
  return raw >= 0x80_0000n ? raw - 0x100_0000n : raw;
}

/** Uses Uniswap's official SDK encoding for the finalized, raw-token genesis ratio. */
export function expectedGenesisSqrtPriceX96(gbx: string, usdG: string, communityUsdG: bigint): bigint {
  if (communityUsdG <= 0n) throw new Error('genesis community USDG must be positive');
  const canonicalGbx = getAddress(gbx);
  const canonicalUsdG = getAddress(usdG);
  if (canonicalGbx === canonicalUsdG) throw new Error('genesis GBX and USDG addresses must differ');
  const gbxIsToken0 = BigInt(canonicalGbx) < BigInt(canonicalUsdG);
  const token0Amount = gbxIsToken0 ? GENESIS_MINER_ALLOCATION : communityUsdG;
  const token1Amount = gbxIsToken0 ? communityUsdG : GENESIS_MINER_ALLOCATION;
  return BigInt(encodeSqrtRatioX96(token1Amount.toString(), token0Amount.toString()).toString());
}

export interface ObservedGenesisSettlementTransaction {
  blockNumber: number | null;
  data: string;
  hash: string;
  receiptBlockNumber: number;
  receiptHash: string;
  receiptStatus: number | null;
  to: string | null;
  value: bigint;
}

/** Binds the signed deployment-state settlement receipt to the exact official-SDK price witness. */
export function assertObservedGenesisSettlementTransaction(
  actual: ObservedGenesisSettlementTransaction,
  state: DeploymentState,
  config: DeploymentConfig,
  communityUsdG: bigint,
  observationBlock: bigint,
): void {
  const recorded = state.transactions['genesis:settle'];
  if (recorded === undefined) throw new Error('genesis settlement lacks deployment-state transaction provenance');
  if (
    actual.blockNumber === null ||
    actual.hash.toLowerCase() !== recorded.hash.toLowerCase() ||
    actual.receiptHash.toLowerCase() !== recorded.hash.toLowerCase() ||
    actual.blockNumber !== recorded.blockNumber ||
    actual.receiptBlockNumber !== recorded.blockNumber ||
    actual.receiptStatus !== 1 ||
    BigInt(recorded.blockNumber) > observationBlock
  ) {
    throw new Error('genesis settlement transaction or successful receipt does not match deployment state');
  }
  if (actual.to === null || getAddress(actual.to) !== getAddress(state.addresses.genesisBootstrap)) {
    throw new Error('genesis settlement transaction does not target the canonical bootstrap');
  }
  if (actual.value !== 0n) throw new Error('genesis settlement transaction carries unexpected native value');

  const expectedSqrtPriceX96 = expectedGenesisSqrtPriceX96(
    poolFacingGBXCurrency(config, state),
    config.usdG,
    communityUsdG,
  );
  const expectedData = new Interface(['function settle(uint160 sqrtPriceX96)']).encodeFunctionData('settle', [
    expectedSqrtPriceX96,
  ]);
  if (actual.data !== expectedData) {
    throw new Error('genesis settlement calldata does not contain the official-SDK-derived price witness');
  }
}

/** Delegates exact tick conversion to the pinned official Uniswap SDK. */
export function sqrtPriceX96AtTick(tick: bigint): bigint {
  if (tick < MIN_TICK || tick > MAX_TICK) throw new Error(`tick ${tick} is outside Uniswap v4 bounds`);
  return BigInt(TickMath.getSqrtRatioAtTick(Number(tick)).toString());
}

function divideRoundingUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('rounded division denominator must be positive');
  return numerator / denominator + (numerator % denominator === 0n ? 0n : 1n);
}

/** Mirrors v4 SqrtPriceMath's rounded-up one-sided token delta for a position. */
export function genesisPositionPrincipal(
  tickLower: bigint,
  tickUpper: bigint,
  liquidity: bigint,
  gbxIsToken0: boolean,
): bigint {
  if (liquidity < 0n || liquidity > MAX_UINT128) throw new Error('position liquidity is outside uint128 bounds');
  const sqrtLower = sqrtPriceX96AtTick(tickLower);
  const sqrtUpper = sqrtPriceX96AtTick(tickUpper);
  if (sqrtLower >= sqrtUpper) throw new Error('genesis position square-root price range is invalid');
  const delta = sqrtUpper - sqrtLower;
  if (!gbxIsToken0) return divideRoundingUp(liquidity * delta, 1n << 96n);
  const numerator = liquidity << 96n;
  const dividedByUpper = divideRoundingUp(numerator * delta, sqrtUpper);
  return divideRoundingUp(dividedByUpper, sqrtLower);
}

function alignTickDown(tick: bigint, spacing: bigint): bigint {
  if (spacing <= 0n) throw new Error('canonical tick spacing must be positive');
  let quotient = tick / spacing;
  if (tick < 0n && tick % spacing !== 0n) quotient -= 1n;
  return quotient * spacing;
}

function alignTickUp(tick: bigint, spacing: bigint): bigint {
  const down = alignTickDown(tick, spacing);
  return down === tick ? down : down + spacing;
}

function assertTickMatchesSqrtPrice(tick: bigint, sqrtPriceX96: bigint): void {
  if (sqrtPriceX96 < sqrtPriceX96AtTick(tick)) {
    throw new Error('canonical v4 pool square-root price is below its reported tick');
  }
  if (tick < MAX_TICK && sqrtPriceX96 >= sqrtPriceX96AtTick(tick + 1n)) {
    throw new Error('canonical v4 pool square-root price is above its reported tick');
  }
}

export function positionInfoTicks(packedPositionInfo: bigint): { tickLower: bigint; tickUpper: bigint } {
  return {
    tickLower: signedInt24(packedPositionInfo, 8n),
    tickUpper: signedInt24(packedPositionInfo, 32n),
  };
}

function assertPoolKey(actual: ObservedPoolKey, expected: ObservedPoolKey, label: string): void {
  equalAddress(actual.currency0, expected.currency0, `${label} currency0`);
  equalAddress(actual.currency1, expected.currency1, `${label} currency1`);
  equalAddress(actual.hooks, expected.hooks, `${label} hooks`);
  if (actual.fee !== expected.fee) throw new Error(`${label} fee mismatch`);
  if (actual.tickSpacing !== expected.tickSpacing) throw new Error(`${label} tick spacing mismatch`);
}

/** Compares external v4 position/custody evidence with the exact settled GumBall genesis record. */
export function assertObservedGenesisLiquidity(
  actual: ObservedGenesisLiquidity,
  config: DeploymentConfig,
  state: DeploymentState,
): void {
  const poolGbxCurrency = poolFacingGBXCurrency(config, state);
  const sortedCurrencies = [poolGbxCurrency, getAddress(config.usdG)].sort((left, right) =>
    BigInt(left) < BigInt(right) ? -1 : 1,
  );
  const expectedPoolKey: ObservedPoolKey = {
    currency0: sortedCurrencies[0]!,
    currency1: sortedCurrencies[1]!,
    fee: BigInt(config.liquidity.poolFee),
    hooks: state.addresses.launchGuardHook,
    tickSpacing: BigInt(config.liquidity.tickSpacing),
  };

  equalAddress(
    actual.positionManagerPoolManager,
    config.uniswapV4.poolManager,
    'PositionManager canonical PoolManager',
  );
  equalAddress(actual.positionManagerPermit2, config.uniswapV4.permit2, 'PositionManager canonical Permit2');
  equalAddress(actual.stateViewPoolManager, config.uniswapV4.poolManager, 'StateView canonical PoolManager');

  const expectedSqrtPriceX96 = expectedGenesisSqrtPriceX96(poolGbxCurrency, config.usdG, actual.communityUsdG);
  if (actual.genesisSqrtPriceX96 !== expectedSqrtPriceX96) {
    throw new Error('recorded genesis square-root price does not match the endogenous community clearing ratio');
  }
  assertTickMatchesSqrtPrice(actual.genesisTick, actual.genesisSqrtPriceX96);

  const tickSpacing = BigInt(config.liquidity.tickSpacing);
  const gbxIsToken0 = BigInt(poolGbxCurrency) < BigInt(getAddress(config.usdG));
  let boundary = gbxIsToken0
    ? alignTickUp(actual.genesisTick, tickSpacing)
    : alignTickDown(actual.genesisTick, tickSpacing);
  if (gbxIsToken0 && sqrtPriceX96AtTick(boundary) < actual.genesisSqrtPriceX96) boundary += tickSpacing;
  const cumulativeDeltas = config.liquidity.cumulativeTickDeltas.map((delta) => BigInt(delta));
  for (let index = 0; index < cumulativeDeltas.length; index += 1) {
    const previous = index === 0 ? 0n : cumulativeDeltas[index - 1]!;
    const current = cumulativeDeltas[index]!;
    if (current <= previous || current % tickSpacing !== 0n) {
      throw new Error(`canonical genesis range delta ${index} is invalid`);
    }
  }
  let allocatedCap = 0n;
  const positionCaps = config.liquidity.allocationBps.map((allocationBps, index) => {
    const cap =
      index + 1 === config.liquidity.allocationBps.length
        ? GENESIS_LIQUIDITY_ALLOCATION - allocatedCap
        : (GENESIS_LIQUIDITY_ALLOCATION * BigInt(allocationBps)) / 10_000n;
    allocatedCap += cap;
    return cap;
  });

  const expectedSponsor = (actual.communityUsdG + 3n) / 4n;
  if (actual.requiredSponsorUsdG !== expectedSponsor) {
    throw new Error('genesis sponsor backing is not the exact 20/80 ceiling');
  }
  if (actual.vaultUsdGBalance < actual.communityUsdG + actual.requiredSponsorUsdG) {
    throw new Error('GumBallVault USDG custody is below settled community plus sponsor backing');
  }
  if (actual.positions.length !== 4) throw new Error('canonical genesis does not contain four v4 positions');
  if (actual.maxActivePositions !== MAX_ACTIVE_LIQUIDITY_POSITIONS) {
    throw new Error('LiquidityManager active-position cap is not 16');
  }
  if (actual.activePositionCount !== 4n) {
    throw new Error('LiquidityManager active-position count is not four at genesis');
  }
  if (new Set(actual.positions.map(({ positionId }) => positionId.toString())).size !== 4) {
    throw new Error('canonical genesis position IDs are not unique');
  }

  let recordedPrincipal = 0n;
  const firstPositionId = actual.positions[0]!.positionId;
  for (let index = 0; index < actual.positions.length; index += 1) {
    const position = actual.positions[index]!;
    const label = `genesis v4 position ${index}`;
    if (position.positionId === 0n) throw new Error(`${label} has a zero token ID`);
    if (position.positionId !== firstPositionId + BigInt(index)) {
      throw new Error(`${label} token ID is not part of the consecutive genesis mint`);
    }
    if (!position.exists) throw new Error(`${label} is not active in LiquidityManager`);
    equalAddress(position.owner, state.addresses.liquidityManager, `${label} owner`);
    assertPoolKey(position.poolKey, expectedPoolKey, label);
    if (position.liquidity === 0n) throw new Error(`${label} has zero PositionManager liquidity`);
    if (position.gbxPrincipal === 0n) throw new Error(`${label} has zero recorded GBX principal`);
    if (position.storedLiquidity !== position.liquidity) {
      throw new Error(`${label} PositionManager liquidity differs from LiquidityManager`);
    }
    const packedTicks = positionInfoTicks(position.packedPositionInfo);
    if (packedTicks.tickLower !== position.tickLower || packedTicks.tickUpper !== position.tickUpper) {
      throw new Error(`${label} PositionManager ticks differ from LiquidityManager`);
    }
    const previousDelta = index === 0 ? 0n : cumulativeDeltas[index - 1]!;
    const currentDelta = cumulativeDeltas[index]!;
    const expectedTickLower = gbxIsToken0 ? boundary + previousDelta : boundary - currentDelta;
    const expectedTickUpper = gbxIsToken0 ? boundary + currentDelta : boundary - previousDelta;
    if (position.tickLower !== expectedTickLower || position.tickUpper !== expectedTickUpper) {
      throw new Error(`${label} ticks do not match the canonical one-sided genesis ladder`);
    }
    const recomputedPrincipal = genesisPositionPrincipal(
      position.tickLower,
      position.tickUpper,
      position.liquidity,
      gbxIsToken0,
    );
    if (position.gbxPrincipal !== recomputedPrincipal) {
      throw new Error(`${label} recorded GBX principal does not match v4 rounded-up liquidity math`);
    }
    const cap = positionCaps[index]!;
    if (recomputedPrincipal > cap) throw new Error(`${label} GBX principal exceeds its genesis allocation cap`);
    if (
      position.liquidity !== MAX_UINT128 &&
      genesisPositionPrincipal(position.tickLower, position.tickUpper, position.liquidity + 1n, gbxIsToken0) <= cap
    ) {
      throw new Error(`${label} PositionManager liquidity is not maximal for its genesis allocation cap`);
    }
    recordedPrincipal += position.gbxPrincipal;
  }
  if (recordedPrincipal !== actual.genesisPrincipal) {
    throw new Error('externally proven genesis positions do not equal recorded GBX principal');
  }
  if (actual.poolManagerGbxBalance !== actual.genesisPrincipal) {
    throw new Error('PoolManager GBX custody does not equal the genesis position principal');
  }
  if (
    config.liquidity.mode === 'permissioned' &&
    (actual.adapterUnderlyingBalance !== actual.genesisPrincipal ||
      actual.adapterTotalSupply !== actual.genesisPrincipal)
  ) {
    throw new Error('permissioned adapter is not backed one-for-one by the genesis position principal');
  }
  if (
    config.liquidity.mode === 'permissioned' &&
    (!actual.permissionedBootstrapEnableConsumed || !actual.permissionedSwappingEnabled)
  ) {
    throw new Error('permissioned canonical swaps were not activated after genesis');
  }
  if (
    actual.poolSqrtPriceX96 !== actual.genesisSqrtPriceX96 ||
    actual.poolTick !== actual.genesisTick ||
    actual.poolSqrtPriceX96 === 0n
  ) {
    throw new Error('canonical v4 pool slot0 does not match the endogenous genesis price');
  }
}

function poolKeyResult(value: unknown, label: string): ObservedPoolKey {
  if (value === null || typeof value !== 'object') throw new Error(`${label} is not a PoolKey result`);
  const result = value as {
    currency0: string;
    currency1: string;
    fee: bigint;
    hooks: string;
    tickSpacing: bigint;
  };
  return {
    currency0: result.currency0,
    currency1: result.currency1,
    fee: result.fee,
    hooks: result.hooks,
    tickSpacing: result.tickSpacing,
  };
}

/** Reads external v4 ownership/state plus backing balances using the caller's observation-block-pinned provider. */
export async function verifyGenesisLiquidity(
  provider: Provider,
  state: DeploymentState,
  config: DeploymentConfig,
  manifest: ReleaseManifest,
): Promise<void> {
  const addresses = state.addresses;
  const poolGbxCurrency = poolFacingGBXCurrency(config, state);
  const underlyingGbx = new Contract(addresses.gbx, ERC20_BALANCE_ABI, provider);
  const poolGbx = new Contract(
    poolGbxCurrency,
    [
      ...ERC20_BALANCE_ABI,
      'function totalSupply() view returns (uint256)',
      'function swappingEnabled() view returns (bool)',
    ],
    provider,
  );
  const usdG = new Contract(config.usdG, ERC20_BALANCE_ABI, provider);
  const bootstrap = new Contract(addresses.genesisBootstrap, BOOTSTRAP_BACKING_ABI, provider);
  const manager = new Contract(addresses.liquidityManager, LIQUIDITY_MANAGER_GENESIS_ABI, provider);
  const positionManager = new Contract(config.uniswapV4.positionManager, POSITION_MANAGER_GENESIS_ABI, provider);

  const canonicalPoolKey = poolKeyResult(await manager.getFunction('poolKey')(), 'LiquidityManager pool key');
  const encodedPoolKey = AbiCoder.defaultAbiCoder().encode(
    ['tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)'],
    [canonicalPoolKey],
  );
  const poolId = keccak256(encodedPoolKey);
  const stateViewRecord = manifest.externalContracts.find(({ key }) => key === 'uniswapV4.stateView');
  if (stateViewRecord === undefined) throw new Error('release manifest lacks the canonical Uniswap v4 StateView');
  const stateView = new Contract(stateViewRecord.address, STATE_VIEW_ABI, provider);
  const slot0 = (await stateView.getFunction('getSlot0')(poolId)) as readonly [bigint, bigint, bigint, bigint];

  const positions: ObservedGenesisPosition[] = [];
  for (let index = 0; index < 4; index += 1) {
    const positionId = (await manager.getFunction('positionIds')(index)) as bigint;
    const record = (await manager.getFunction('positionRecord')(positionId)) as {
      exists: boolean;
      gbxPrincipal: bigint;
      liquidity: bigint;
      tickLower: bigint;
      tickUpper: bigint;
    };
    const positionInfo = (await positionManager.getFunction('getPoolAndPositionInfo')(positionId)) as readonly [
      unknown,
      bigint,
    ];
    positions.push({
      exists: record.exists,
      gbxPrincipal: record.gbxPrincipal,
      liquidity: (await positionManager.getFunction('getPositionLiquidity')(positionId)) as bigint,
      owner: (await positionManager.getFunction('ownerOf')(positionId)) as string,
      packedPositionInfo: positionInfo[1],
      poolKey: poolKeyResult(positionInfo[0], `PositionManager pool key ${index}`),
      positionId,
      storedLiquidity: record.liquidity,
      tickLower: record.tickLower,
      tickUpper: record.tickUpper,
    });
  }

  let permissionedEvidence:
    | {
        adapterTotalSupply: bigint;
        adapterUnderlyingBalance: bigint;
        permissionedBootstrapEnableConsumed: boolean;
        permissionedSwappingEnabled: boolean;
      }
    | undefined;
  if (config.liquidity.mode === 'permissioned') {
    const controller = new Contract(
      addresses.permissionedPoolController,
      ['function bootstrapSwapEnableConsumed() view returns (bool)'],
      provider,
    );
    permissionedEvidence = {
      adapterTotalSupply: (await poolGbx.getFunction('totalSupply')()) as bigint,
      adapterUnderlyingBalance: (await underlyingGbx.getFunction('balanceOf')(poolGbxCurrency)) as bigint,
      permissionedBootstrapEnableConsumed: (await controller.getFunction('bootstrapSwapEnableConsumed')()) as boolean,
      permissionedSwappingEnabled: (await poolGbx.getFunction('swappingEnabled')()) as boolean,
    };
  }

  assertObservedGenesisLiquidity(
    {
      activePositionCount: (await manager.getFunction('activePositionCount')()) as bigint,
      ...permissionedEvidence,
      communityUsdG: (await bootstrap.getFunction('communityUSDG')()) as bigint,
      genesisPrincipal: (await manager.getFunction('genesisLiquidityPrincipal')()) as bigint,
      genesisSqrtPriceX96: (await manager.getFunction('genesisSqrtPriceX96')()) as bigint,
      genesisTick: (await manager.getFunction('genesisTick')()) as bigint,
      maxActivePositions: (await manager.getFunction('MAX_ACTIVE_POSITIONS')()) as bigint,
      poolManagerGbxBalance: (await poolGbx.getFunction('balanceOf')(config.uniswapV4.poolManager)) as bigint,
      poolSqrtPriceX96: slot0[0],
      poolTick: slot0[1],
      positionManagerPermit2: (await positionManager.getFunction('permit2')()) as string,
      positionManagerPoolManager: (await positionManager.getFunction('poolManager')()) as string,
      positions,
      requiredSponsorUsdG: (await bootstrap.getFunction('requiredSponsorUSDG')()) as bigint,
      stateViewPoolManager: (await stateView.getFunction('poolManager')()) as string,
      vaultUsdGBalance: (await usdG.getFunction('balanceOf')(addresses.gumBallVault)) as bigint,
    },
    config,
    state,
  );
}
