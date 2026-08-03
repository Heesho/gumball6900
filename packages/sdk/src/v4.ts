import { Price, Token } from '@uniswap/sdk-core';
import { encodeSqrtRatioX96, nearestUsableTick, TickMath } from '@uniswap/v3-sdk';
import { Pool, Position, priceToClosestTick, tickToPrice } from '@uniswap/v4-sdk';
import JSBI from 'jsbi';
import {
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  isHex,
  size,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { z } from 'zod';

import { v4QuoterAbi } from './abis.js';
import { pinBlockSnapshot, revalidateBlockSnapshot } from './block-snapshot.js';
import { GENESIS_MINER_ALLOCATION } from './math/constants.js';
import { assertTokenDecimals, assertUint, positiveBigIntSchema, tokenDecimalsSchema } from './validation.js';

export const CANONICAL_V4_FEE = 3_000;
export const CANONICAL_V4_TICK_SPACING = 60;

export interface CanonicalPoolKey {
  readonly currency0: Address;
  readonly currency1: Address;
  readonly fee: number;
  readonly tickSpacing: number;
  readonly hooks: Address;
}

export interface PoolTokenMetadata {
  readonly address: Address;
  readonly chainId: number;
  readonly decimals: number;
  readonly symbol?: string;
}

const poolTokenSchema = z.object({
  address: z.string(),
  chainId: z.number().int().positive().safe(),
  decimals: tokenDecimalsSchema,
  symbol: z.string().min(1).optional(),
});

function sdkToken(metadata: PoolTokenMetadata): Token {
  poolTokenSchema.parse(metadata);
  return new Token(metadata.chainId, getAddress(metadata.address), metadata.decimals, metadata.symbol);
}

/**
 * Builds the canonical Solidity PoolKey through Uniswap's v4 SDK.
 * Token metadata is mandatory because the canonical USDG token uses six decimals.
 */
export function canonicalPoolKey(
  gbx: Address,
  usdG: Address,
  launchGuardHook: Address,
  metadata: Readonly<{ chainId: number; gbxDecimals: number; usdGDecimals: number }>,
): CanonicalPoolKey {
  const gbxToken = sdkToken({ address: getAddress(gbx), chainId: metadata.chainId, decimals: metadata.gbxDecimals });
  const usdGToken = sdkToken({ address: getAddress(usdG), chainId: metadata.chainId, decimals: metadata.usdGDecimals });
  if (gbxToken.equals(usdGToken)) throw new RangeError('pool tokens must differ');
  const key = Pool.getPoolKey(
    gbxToken,
    usdGToken,
    CANONICAL_V4_FEE,
    CANONICAL_V4_TICK_SPACING,
    getAddress(launchGuardHook),
  );
  return {
    currency0: getAddress(key.currency0),
    currency1: getAddress(key.currency1),
    fee: key.fee,
    tickSpacing: key.tickSpacing,
    hooks: getAddress(key.hooks),
  };
}

/** Returns the official Uniswap v4 SDK PoolId for the canonical sorted GBX/USDG PoolKey. */
export function canonicalPoolId(
  gbx: Address,
  usdG: Address,
  launchGuardHook: Address,
  metadata: Readonly<{ chainId: number; gbxDecimals: number; usdGDecimals: number }>,
): Hex {
  const gbxToken = sdkToken({ address: getAddress(gbx), chainId: metadata.chainId, decimals: metadata.gbxDecimals });
  const usdGToken = sdkToken({ address: getAddress(usdG), chainId: metadata.chainId, decimals: metadata.usdGDecimals });
  if (gbxToken.equals(usdGToken)) throw new RangeError('pool tokens must differ');
  const id = Pool.getPoolId(
    gbxToken,
    usdGToken,
    CANONICAL_V4_FEE,
    CANONICAL_V4_TICK_SPACING,
    getAddress(launchGuardHook),
  );
  if (!isHex(id, { strict: true }) || size(id) !== 32) throw new Error('Uniswap v4 SDK returned an invalid PoolId.');
  return id;
}

/** Uses Uniswap's canonical integer encodeSqrtRatioX96 implementation; amount1/amount0 is a raw-unit ratio. */
export function sqrtPriceX96FromRawAmounts(amount0: bigint, amount1: bigint): bigint {
  positiveBigIntSchema.parse(amount0);
  positiveBigIntSchema.parse(amount1);
  const result = BigInt(encodeSqrtRatioX96(amount1.toString(), amount0.toString()).toString());
  assertUint(result, 160, 'sqrtPriceX96');
  return result;
}

/** Sorts GBX/USDG and delegates the exact finalized genesis ratio to Uniswap's official SDK encoder. */
export function genesisSqrtPriceX96(gbx: Address, usdG: Address, communityUSDGRaw: bigint): bigint {
  const canonicalGbx = getAddress(gbx);
  const canonicalUsdG = getAddress(usdG);
  if (canonicalGbx === canonicalUsdG) throw new RangeError('genesis pool tokens must differ');
  positiveBigIntSchema.parse(communityUSDGRaw);
  return BigInt(canonicalGbx) < BigInt(canonicalUsdG)
    ? sqrtPriceX96FromRawAmounts(GENESIS_MINER_ALLOCATION, communityUSDGRaw)
    : sqrtPriceX96FromRawAmounts(communityUSDGRaw, GENESIS_MINER_ALLOCATION);
}

export function sqrtPriceX96AtTick(tick: number): bigint {
  if (!Number.isSafeInteger(tick)) throw new RangeError('tick must be a safe integer');
  return BigInt(TickMath.getSqrtRatioAtTick(tick).toString());
}

export function tickAtSqrtPriceX96(sqrtPriceX96: bigint): number {
  positiveBigIntSchema.parse(sqrtPriceX96);
  assertUint(sqrtPriceX96, 160, 'sqrtPriceX96');
  return TickMath.getTickAtSqrtRatio(JSBI.BigInt(sqrtPriceX96.toString()));
}

export function nearestCanonicalUsableTick(tick: number): number {
  if (!Number.isSafeInteger(tick)) throw new RangeError('tick must be a safe integer');
  return nearestUsableTick(tick, CANONICAL_V4_TICK_SPACING);
}

/**
 * Converts an exact raw quote/base ratio to the closest v4 tick through Uniswap's Price and v4 conversion helper.
 * Token decimals are explicit and no JavaScript floating-point financial value is accepted.
 */
export function closestV4TickForRawPrice(
  base: PoolTokenMetadata,
  quote: PoolTokenMetadata,
  baseAmountRaw: bigint,
  quoteAmountRaw: bigint,
): number {
  positiveBigIntSchema.parse(baseAmountRaw);
  positiveBigIntSchema.parse(quoteAmountRaw);
  const baseToken = sdkToken(base);
  const quoteToken = sdkToken(quote);
  if (baseToken.chainId !== quoteToken.chainId) throw new RangeError('pool tokens must share a chain');
  const price = new Price(baseToken, quoteToken, baseAmountRaw.toString(), quoteAmountRaw.toString());
  return priceToClosestTick(price);
}

/** Returns the SDK price's exact raw numerator and denominator for a tick; formatting remains a UI concern. */
export function rawPriceAtV4Tick(base: PoolTokenMetadata, quote: PoolTokenMetadata, tick: number) {
  assertTokenDecimals(base.decimals, 'base.decimals');
  assertTokenDecimals(quote.decimals, 'quote.decimals');
  const price = tickToPrice(sdkToken(base), sdkToken(quote), tick);
  return {
    denominator: BigInt(price.denominator.toString()),
    numerator: BigInt(price.numerator.toString()),
  } as const;
}

export interface CanonicalV4PoolStateParameters {
  readonly activeLiquidity: bigint;
  readonly currentTick: number;
  readonly gbx: PoolTokenMetadata;
  readonly launchGuardHook: Address;
  readonly sqrtPriceX96: bigint;
  readonly usdG: PoolTokenMetadata;
}

export interface CanonicalV4PositionPrincipalParameters extends CanonicalV4PoolStateParameters {
  readonly liquidity: bigint;
  readonly tickLower: number;
  readonly tickUpper: number;
}

export interface CanonicalV4PositionPrincipal {
  /** Raw GBX principal represented by the position's liquidity at the supplied pool price. */
  readonly gbxRaw: bigint;
  /** Raw USDG principal represented by the position's liquidity at the supplied pool price. */
  readonly usdGRaw: bigint;
}

export interface CanonicalV4GBXPrice {
  /** Exact human-unit USDG-per-GBX numerator. */
  readonly numerator: bigint;
  /** Exact human-unit USDG-per-GBX denominator. */
  readonly denominator: bigint;
}

function canonicalV4PoolState(parameters: CanonicalV4PoolStateParameters) {
  const gbx = sdkToken(parameters.gbx);
  const usdG = sdkToken(parameters.usdG);
  if (gbx.chainId !== usdG.chainId) throw new RangeError('pool tokens must share a chain');
  if (gbx.equals(usdG)) throw new RangeError('pool tokens must differ');
  assertUint(parameters.sqrtPriceX96, 160, 'sqrtPriceX96');
  assertUint(parameters.activeLiquidity, 128, 'activeLiquidity');
  const pool = new Pool(
    gbx,
    usdG,
    CANONICAL_V4_FEE,
    CANONICAL_V4_TICK_SPACING,
    getAddress(parameters.launchGuardHook),
    parameters.sqrtPriceX96.toString(),
    parameters.activeLiquidity.toString(),
    parameters.currentTick,
  );
  return { gbx, pool, usdG } as const;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/**
 * Returns the exact human-unit USDG price of one GBX from the official v4 Pool price at the supplied slot0 state.
 * Currency ordering and both token decimal scales are applied before the reduced rational is returned.
 */
export function canonicalV4GBXPriceInUSDG(parameters: CanonicalV4PoolStateParameters): CanonicalV4GBXPrice {
  const { gbx, pool, usdG } = canonicalV4PoolState(parameters);
  const price = pool.priceOf(gbx);
  if (!price.quoteCurrency.equals(usdG)) throw new Error('Canonical v4 GBX price returned an unexpected quote token.');
  const numerator = BigInt(price.numerator.toString()) * 10n ** BigInt(gbx.decimals);
  const denominator = BigInt(price.denominator.toString()) * 10n ** BigInt(usdG.decimals);
  if (numerator <= 0n || denominator <= 0n) throw new Error('Canonical v4 GBX price must be positive.');
  const divisor = greatestCommonDivisor(numerator, denominator);
  return { denominator: denominator / divisor, numerator: numerator / divisor };
}

/**
 * Computes the raw principal composition of one canonical v4 position using the official Uniswap v4 `Pool` and
 * `Position` implementations. The result excludes fees owed to the NFT because neither liquidity nor slot0 encodes
 * those fee-growth checkpoints.
 */
export function canonicalV4PositionPrincipal(
  parameters: CanonicalV4PositionPrincipalParameters,
): CanonicalV4PositionPrincipal {
  const { gbx, pool, usdG } = canonicalV4PoolState(parameters);
  assertUint(parameters.liquidity, 128, 'position liquidity');
  const position = new Position({
    liquidity: parameters.liquidity.toString(),
    pool,
    tickLower: parameters.tickLower,
    tickUpper: parameters.tickUpper,
  });
  const amount0Raw = BigInt(position.amount0.quotient.toString());
  const amount1Raw = BigInt(position.amount1.quotient.toString());
  return gbx.sortsBefore(usdG)
    ? { gbxRaw: amount0Raw, usdGRaw: amount1Raw }
    : { gbxRaw: amount1Raw, usdGRaw: amount0Raw };
}

export interface CanonicalV4ExactInputQuoteParameters {
  /** Must come from a verified deployment manifest; unresolved/provisional Quoter addresses must not be used. */
  readonly quoter: Address;
  readonly poolKey: CanonicalPoolKey;
  readonly inputCurrency: Address;
  readonly exactAmountRaw: bigint;
  readonly inputDecimals: number;
  readonly outputDecimals: number;
  readonly atBlock?: bigint;
  /** Optional hash binding for comparing multiple quotes at one exact canonical block. */
  readonly expectedBlockHash?: Hex;
}

export interface CanonicalV4ExactInputQuote {
  readonly amountInRaw: bigint;
  readonly amountOutRaw: bigint;
  readonly blockNumber: bigint;
  readonly gasEstimate: bigint;
  readonly inputCurrency: Address;
  readonly inputDecimals: number;
  readonly outputCurrency: Address;
  readonly outputDecimals: number;
  readonly zeroForOne: boolean;
}

/**
 * Reads the official v4 Quoter's single-pool exact-input result for the canonical pool.
 * This deliberately returns no Universal Router calldata and accepts no arbitrary path or hook data.
 */
export async function readCanonicalV4ExactInputQuote(
  client: PublicClient,
  parameters: CanonicalV4ExactInputQuoteParameters,
): Promise<CanonicalV4ExactInputQuote> {
  positiveBigIntSchema.parse(parameters.exactAmountRaw);
  assertUint(parameters.exactAmountRaw, 128, 'exactAmountRaw');
  assertTokenDecimals(parameters.inputDecimals, 'inputDecimals');
  assertTokenDecimals(parameters.outputDecimals, 'outputDecimals');
  if (parameters.poolKey.fee !== CANONICAL_V4_FEE || parameters.poolKey.tickSpacing !== CANONICAL_V4_TICK_SPACING) {
    throw new RangeError('quote PoolKey must use the canonical fee and tick spacing');
  }
  const currency0 = getAddress(parameters.poolKey.currency0);
  const currency1 = getAddress(parameters.poolKey.currency1);
  if (currency0.toLowerCase() >= currency1.toLowerCase()) {
    throw new RangeError('quote PoolKey currencies must be strictly address-sorted');
  }
  const inputCurrency = getAddress(parameters.inputCurrency);
  const zeroForOne = inputCurrency.toLowerCase() === currency0.toLowerCase();
  if (!zeroForOne && inputCurrency.toLowerCase() !== currency1.toLowerCase()) {
    throw new RangeError('inputCurrency is not in the canonical PoolKey');
  }
  const atBlock =
    parameters.atBlock === undefined ? undefined : positiveBigIntSchema.or(z.literal(0n)).parse(parameters.atBlock);
  const snapshot = await pinBlockSnapshot(client, atBlock, parameters.expectedBlockHash);
  const { blockNumber } = snapshot;
  const call = await client.call({
    to: getAddress(parameters.quoter),
    blockNumber,
    data: encodeFunctionData({
      abi: v4QuoterAbi,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          exactAmount: parameters.exactAmountRaw,
          hookData: '0x',
          poolKey: {
            currency0,
            currency1,
            fee: parameters.poolKey.fee,
            hooks: getAddress(parameters.poolKey.hooks),
            tickSpacing: parameters.poolKey.tickSpacing,
          },
          zeroForOne,
        },
      ],
    }),
  });
  if (call.data === undefined) throw new TypeError('v4 Quoter returned no data');
  const raw = decodeFunctionResult({ abi: v4QuoterAbi, functionName: 'quoteExactInputSingle', data: call.data });
  const [amountOutRaw, gasEstimate] = z.tuple([z.bigint().nonnegative(), z.bigint().nonnegative()]).parse(raw);
  await revalidateBlockSnapshot(client, snapshot);
  return {
    amountInRaw: parameters.exactAmountRaw,
    amountOutRaw,
    blockNumber,
    gasEstimate,
    inputCurrency,
    inputDecimals: parameters.inputDecimals,
    outputCurrency: zeroForOne ? currency1 : currency0,
    outputDecimals: parameters.outputDecimals,
    zeroForOne,
  };
}
