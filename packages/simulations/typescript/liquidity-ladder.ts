import { CurrencyAmount, Token } from '@uniswap/sdk-core';
import { TickMath } from '@uniswap/v3-sdk';
import { Pool, Position } from '@uniswap/v4-sdk';

import {
  CANONICAL_V4_FEE,
  CANONICAL_V4_TICK_SPACING,
  sqrtPriceX96AtTick,
  sqrtPriceX96FromRawAmounts,
  tickAtSqrtPriceX96,
} from '@gumball-6900/sdk';

const WAD = 10n ** 18n;
const BPS_DENOMINATOR = 10_000n;
const Q128 = 1n << 128n;

export const GENESIS_LIQUIDITY_GBX_RAW = 20_000_000n * WAD;
export const GENESIS_MINER_GBX_RAW = 80_000_000n * WAD;
export const GENESIS_COMMUNITY_USDG_RAW = 80_000_000n * 10n ** 6n;

export const DEFAULT_GENESIS_LADDER = [
  { allocationBps: 5_000, cumulativeTickDelta: 4_080 },
  { allocationBps: 3_000, cumulativeTickDelta: 10_980 },
  { allocationBps: 1_500, cumulativeTickDelta: 17_940 },
  { allocationBps: 500, cumulativeTickDelta: 24_900 },
] as const;

export type LadderOrdering = 'gbx-token0' | 'gbx-token1';

export interface LadderPositionSnapshot {
  readonly allocationBps: number;
  readonly allocationCapGBXRaw: bigint;
  readonly genesisPrincipalGBXRaw: bigint;
  readonly gbxRaw: bigint;
  readonly liquidity: bigint;
  readonly tickLower: number;
  readonly tickUpper: number;
  readonly usdGRaw: bigint;
}

export interface LadderState {
  readonly activeLiquidity: bigint;
  readonly gbxPriceUSDGWad: bigint;
  readonly gbxRemainingRaw: bigint;
  readonly genesisPriceMultipleWad: bigint;
  readonly positions: readonly LadderPositionSnapshot[];
  readonly sqrtPriceX96: bigint;
  readonly tick: number;
  readonly usdGInventoryRaw: bigint;
}

export interface LadderTradeResult {
  readonly after: LadderState;
  readonly before: LadderState;
  readonly direction: 'GBX_TO_USDG' | 'USDG_TO_GBX';
  readonly executionOutputRaw: bigint;
  readonly inputRaw: bigint;
  readonly midPriceOutputRaw: bigint;
  readonly poolAfter: Pool;
  /** Execution-price loss versus the pre-trade mid price, including the canonical 0.30% LP fee. */
  readonly priceImpactBps: bigint;
}

interface LadderPositionDefinition {
  readonly allocationBps: number;
  readonly allocationCapGBXRaw: bigint;
  readonly genesisPrincipalGBXRaw: bigint;
  readonly liquidity: bigint;
  readonly tickLower: number;
  readonly tickUpper: number;
}

export interface CanonicalLadderModel {
  readonly gbx: Token;
  readonly genesisGBXPriceUSDGWad: bigint;
  readonly genesisPrincipalGBXRaw: bigint;
  readonly genesisResidualGBXRaw: bigint;
  readonly ordering: LadderOrdering;
  readonly pool: Pool;
  readonly positions: readonly LadderPositionDefinition[];
  readonly usdG: Token;
}

function tokenAddresses(ordering: LadderOrdering) {
  return ordering === 'gbx-token0'
    ? {
        gbx: '0x0000000000000000000000000000000000000100',
        usdG: '0x0000000000000000000000000000000000000200',
      }
    : {
        gbx: '0x0000000000000000000000000000000000000200',
        usdG: '0x0000000000000000000000000000000000000100',
      };
}

function alignTickDown(tick: number): number {
  return Math.floor(tick / CANONICAL_V4_TICK_SPACING) * CANONICAL_V4_TICK_SPACING;
}

function alignTickUp(tick: number): number {
  return Math.ceil(tick / CANONICAL_V4_TICK_SPACING) * CANONICAL_V4_TICK_SPACING;
}

function oneSidedGBXBoundary(sqrtPriceX96: bigint, tick: number, gbxIsToken0: boolean): number {
  if (!gbxIsToken0) return alignTickDown(tick);
  const aligned = alignTickUp(tick);
  return sqrtPriceX96AtTick(aligned) < sqrtPriceX96 ? aligned + CANONICAL_V4_TICK_SPACING : aligned;
}

function genesisSqrtPriceX96(gbxIsToken0: boolean): bigint {
  return gbxIsToken0
    ? sqrtPriceX96FromRawAmounts(GENESIS_MINER_GBX_RAW, GENESIS_COMMUNITY_USDG_RAW)
    : sqrtPriceX96FromRawAmounts(GENESIS_COMMUNITY_USDG_RAW, GENESIS_MINER_GBX_RAW);
}

function poolGBXPriceUSDGWad(pool: Pool, gbx: Token, usdG: Token): bigint {
  const price = pool.priceOf(gbx);
  if (!price.quoteCurrency.equals(usdG)) throw new Error('Unexpected ladder quote currency.');
  const numerator = BigInt(price.numerator.toString()) * 10n ** BigInt(gbx.decimals) * WAD;
  const denominator = BigInt(price.denominator.toString()) * 10n ** BigInt(usdG.decimals);
  return numerator / denominator;
}

function buildTickData(positions: readonly LadderPositionDefinition[]) {
  const ticks = new Map<number, { gross: bigint; net: bigint }>();
  for (const position of positions) {
    const lower = ticks.get(position.tickLower) ?? { gross: 0n, net: 0n };
    lower.gross += position.liquidity;
    lower.net += position.liquidity;
    ticks.set(position.tickLower, lower);

    const upper = ticks.get(position.tickUpper) ?? { gross: 0n, net: 0n };
    upper.gross += position.liquidity;
    upper.net -= position.liquidity;
    ticks.set(position.tickUpper, upper);
  }
  return [...ticks.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, liquidity]) => ({
      index,
      liquidityGross: liquidity.gross.toString(),
      liquidityNet: liquidity.net.toString(),
    }));
}

function activeLiquidityAtTick(positions: readonly LadderPositionDefinition[], tick: number): bigint {
  return positions.reduce(
    (total, position) => (position.tickLower <= tick && tick < position.tickUpper ? total + position.liquidity : total),
    0n,
  );
}

/** Builds both currency-ordering variants with official Uniswap v3 TickMath and v4 Pool/Position implementations. */
export function createCanonicalLadderModel(ordering: LadderOrdering = 'gbx-token0'): CanonicalLadderModel {
  const addresses = tokenAddresses(ordering);
  const gbx = new Token(46_630, addresses.gbx, 18, 'GBX');
  const usdG = new Token(46_630, addresses.usdG, 6, 'USDG');
  const gbxIsToken0 = gbx.sortsBefore(usdG);
  if (gbxIsToken0 !== (ordering === 'gbx-token0')) throw new Error('Ladder token ordering fixture is invalid.');

  const sqrtPriceX96 = genesisSqrtPriceX96(gbxIsToken0);
  const currentTick = tickAtSqrtPriceX96(sqrtPriceX96);
  const boundary = oneSidedGBXBoundary(sqrtPriceX96, currentTick, gbxIsToken0);
  const emptyPool = new Pool(
    gbx,
    usdG,
    CANONICAL_V4_FEE,
    CANONICAL_V4_TICK_SPACING,
    '0x0000000000000000000000000000000000002000',
    sqrtPriceX96.toString(),
    '0',
    currentTick,
  );

  let allocated = 0n;
  const positions = DEFAULT_GENESIS_LADDER.map((range, index): LadderPositionDefinition => {
    const allocationCapGBXRaw =
      index + 1 === DEFAULT_GENESIS_LADDER.length
        ? GENESIS_LIQUIDITY_GBX_RAW - allocated
        : (GENESIS_LIQUIDITY_GBX_RAW * BigInt(range.allocationBps)) / BPS_DENOMINATOR;
    allocated += allocationCapGBXRaw;
    const previousDelta = index === 0 ? 0 : DEFAULT_GENESIS_LADDER[index - 1]!.cumulativeTickDelta;
    const tickLower = gbxIsToken0 ? boundary + previousDelta : boundary - range.cumulativeTickDelta;
    const tickUpper = gbxIsToken0 ? boundary + range.cumulativeTickDelta : boundary - previousDelta;
    const position = gbxIsToken0
      ? Position.fromAmount0({
          amount0: allocationCapGBXRaw.toString(),
          pool: emptyPool,
          tickLower,
          tickUpper,
          useFullPrecision: true,
        })
      : Position.fromAmount1({
          amount1: allocationCapGBXRaw.toString(),
          pool: emptyPool,
          tickLower,
          tickUpper,
        });
    const genesisPrincipalGBXRaw = BigInt((gbxIsToken0 ? position.amount0 : position.amount1).quotient.toString());
    return {
      allocationBps: range.allocationBps,
      allocationCapGBXRaw,
      genesisPrincipalGBXRaw,
      liquidity: BigInt(position.liquidity.toString()),
      tickLower,
      tickUpper,
    };
  });

  const activeLiquidity = activeLiquidityAtTick(positions, currentTick);
  const pool = new Pool(
    gbx,
    usdG,
    CANONICAL_V4_FEE,
    CANONICAL_V4_TICK_SPACING,
    '0x0000000000000000000000000000000000002000',
    sqrtPriceX96.toString(),
    activeLiquidity.toString(),
    currentTick,
    buildTickData(positions),
  );
  const genesisPrincipalGBXRaw = positions.reduce((total, position) => total + position.genesisPrincipalGBXRaw, 0n);
  const genesisResidualGBXRaw = GENESIS_LIQUIDITY_GBX_RAW - genesisPrincipalGBXRaw;
  if (genesisResidualGBXRaw < 0n) throw new Error('Official v4 position math exceeded the genesis allocation.');

  return {
    gbx,
    genesisGBXPriceUSDGWad: poolGBXPriceUSDGWad(pool, gbx, usdG),
    genesisPrincipalGBXRaw,
    genesisResidualGBXRaw,
    ordering,
    pool,
    positions,
    usdG,
  };
}

export function liquidityLadderState(model: CanonicalLadderModel, pool: Pool = model.pool): LadderState {
  if (!pool.involvesCurrency(model.gbx) || !pool.involvesCurrency(model.usdG)) {
    throw new Error('Ladder state pool does not contain canonical GBX and USDG.');
  }
  const positions = model.positions.map((definition): LadderPositionSnapshot => {
    const position = new Position({
      liquidity: definition.liquidity.toString(),
      pool,
      tickLower: definition.tickLower,
      tickUpper: definition.tickUpper,
    });
    const amount0 = BigInt(position.amount0.quotient.toString());
    const amount1 = BigInt(position.amount1.quotient.toString());
    return {
      ...definition,
      gbxRaw: model.gbx.sortsBefore(model.usdG) ? amount0 : amount1,
      usdGRaw: model.gbx.sortsBefore(model.usdG) ? amount1 : amount0,
    };
  });
  const gbxPriceUSDGWad = poolGBXPriceUSDGWad(pool, model.gbx, model.usdG);
  return {
    activeLiquidity: BigInt(pool.liquidity.toString()),
    gbxPriceUSDGWad,
    gbxRemainingRaw: positions.reduce((total, position) => total + position.gbxRaw, 0n),
    genesisPriceMultipleWad: (gbxPriceUSDGWad * WAD) / model.genesisGBXPriceUSDGWad,
    positions,
    sqrtPriceX96: BigInt(pool.sqrtRatioX96.toString()),
    tick: pool.tickCurrent,
    usdGInventoryRaw: positions.reduce((total, position) => total + position.usdGRaw, 0n),
  };
}

async function simulateExactInput(
  model: CanonicalLadderModel,
  pool: Pool,
  input: Token,
  inputRaw: bigint,
): Promise<LadderTradeResult> {
  if (inputRaw <= 0n) throw new RangeError('trade input must be positive');
  if (!input.equals(model.gbx) && !input.equals(model.usdG)) throw new RangeError('unsupported ladder input');
  const before = liquidityLadderState(model, pool);
  const inputAmount = CurrencyAmount.fromRawAmount(input, inputRaw.toString());
  const midPriceOutputRaw = BigInt(pool.priceOf(input).quote(inputAmount).quotient.toString());
  if (midPriceOutputRaw === 0n) throw new RangeError('trade is too small for a nonzero mid-price output');
  const [outputAmount, poolAfter] = await pool.getOutputAmount(inputAmount);
  const executionOutputRaw = BigInt(outputAmount.quotient.toString());
  const priceImpactBps =
    executionOutputRaw >= midPriceOutputRaw
      ? 0n
      : ((midPriceOutputRaw - executionOutputRaw) * BPS_DENOMINATOR) / midPriceOutputRaw;
  return {
    after: liquidityLadderState(model, poolAfter),
    before,
    direction: input.equals(model.usdG) ? 'USDG_TO_GBX' : 'GBX_TO_USDG',
    executionOutputRaw,
    inputRaw,
    midPriceOutputRaw,
    poolAfter,
    priceImpactBps,
  };
}

/** Executes a fee-aware exact-input USDG buy through the official v4 SDK tick traversal. */
export function simulateLadderBuy(
  usdGInRaw: bigint,
  ordering: LadderOrdering = 'gbx-token0',
): Promise<LadderTradeResult> {
  const model = createCanonicalLadderModel(ordering);
  return simulateExactInput(model, model.pool, model.usdG, usdGInRaw);
}

/** Executes a GBX sell against the USDG accumulated by an earlier official-SDK buy. */
export async function simulateLadderSellAfterBuy(
  priorUSDGBuyRaw: bigint,
  gbxInRaw: bigint,
  ordering: LadderOrdering = 'gbx-token0',
): Promise<{ readonly buy: LadderTradeResult; readonly sell: LadderTradeResult }> {
  const model = createCanonicalLadderModel(ordering);
  const buy = await simulateExactInput(model, model.pool, model.usdG, priorUSDGBuyRaw);
  const sell = await simulateExactInput(model, buy.poolAfter, model.gbx, gbxInRaw);
  return { buy, sell };
}

/** Independent fee-growth helper used by report assertions; retained here to pin exact Q128 floor semantics. */
export function feeGrowthAmount(liquidity: bigint, growthDeltaX128: bigint): bigint {
  if (liquidity < 0n || growthDeltaX128 < 0n) throw new RangeError('fee-growth inputs must be non-negative');
  return (liquidity * growthDeltaX128) / Q128;
}

export function assertTickWithinBounds(tick: number): void {
  if (tick < TickMath.MIN_TICK || tick > TickMath.MAX_TICK) throw new RangeError('tick is outside v4 bounds');
}
