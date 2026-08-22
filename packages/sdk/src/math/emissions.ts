import {
  BPS_DENOMINATOR,
  MINE_MAX_INITIAL_PRICE,
  MINE_MINIMUM_INITIAL_PRICE,
  MINE_PRICE_DECAY_PERIOD,
  MINE_PRICE_MULTIPLIER,
  PREVIOUS_MINER_BPS,
} from './constants.js';
import { assertNonNegative, assertPositive, mulDiv } from './integer.js';

export interface MiningCurveConfig {
  readonly initialTps: bigint;
  readonly halvingPeriod: bigint;
  readonly tailTps: bigint;
}

export interface MiningAccrualInput {
  readonly elapsedSeconds: bigint;
  readonly slotTps: readonly bigint[];
}

export interface MiningAccrualQuote {
  readonly slotEmissions: readonly bigint[];
  readonly totalEmission: bigint;
}

export interface MiningPaymentQuote {
  readonly payment: bigint;
  readonly previousMinerAmount: bigint;
  readonly resonanceAmount: bigint;
}

/** Returns the prospective global TPS after the given number of seconds since Mine deployment. */
export function miningRateAt(elapsedSinceStart: bigint, config: MiningCurveConfig): bigint {
  assertNonNegative(elapsedSinceStart, 'elapsedSinceStart');
  assertPositive(config.initialTps, 'initialTps');
  assertPositive(config.halvingPeriod, 'halvingPeriod');
  assertPositive(config.tailTps, 'tailTps');
  if (config.tailTps > config.initialTps) throw new RangeError('tailTps must not exceed initialTps');

  const halvings = elapsedSinceStart / config.halvingPeriod;
  const shifted = config.initialTps >> halvings;
  return shifted < config.tailTps ? config.tailTps : shifted;
}

/** Quotes fixed per-slot tenure accrual; time-based halvings never reprice an occupied slot. */
export function quoteMiningAccrual(input: MiningAccrualInput): MiningAccrualQuote {
  assertNonNegative(input.elapsedSeconds, 'elapsedSeconds');
  const slotEmissions = input.slotTps.map((tps, index) => {
    assertNonNegative(tps, `slotTps[${index}]`);
    return tps * input.elapsedSeconds;
  });
  return { slotEmissions, totalEmission: slotEmissions.reduce((sum, amount) => sum + amount, 0n) };
}

/** Quotes a slot's linearly decaying USDG replacement price. */
export function quoteMiningPrice(initialPrice: bigint, elapsedSeconds: bigint): bigint {
  assertNonNegative(initialPrice, 'initialPrice');
  assertNonNegative(elapsedSeconds, 'elapsedSeconds');
  if (elapsedSeconds >= MINE_PRICE_DECAY_PERIOD) return 0n;
  return initialPrice - mulDiv(initialPrice, elapsedSeconds, MINE_PRICE_DECAY_PERIOD);
}

/** Quotes the exact 80/20 replacement split; an empty slot deposits its complete payment into ResonanceRouter. */
export function quoteMiningPayment(payment: bigint, hasPreviousMiner: boolean): MiningPaymentQuote {
  assertNonNegative(payment, 'payment');
  const previousMinerAmount = hasPreviousMiner ? mulDiv(payment, PREVIOUS_MINER_BPS, BPS_DENOMINATOR) : 0n;
  return { payment, previousMinerAmount, resonanceAmount: payment - previousMinerAmount };
}

/** Computes the next slot starting price using Mine's fixed multiplier, floor, and ceiling. */
export function nextMiningInitialPrice(payment: bigint): bigint {
  assertNonNegative(payment, 'payment');
  const multiplied = payment * MINE_PRICE_MULTIPLIER;
  if (multiplied < MINE_MINIMUM_INITIAL_PRICE) return MINE_MINIMUM_INITIAL_PRICE;
  if (multiplied > MINE_MAX_INITIAL_PRICE) return MINE_MAX_INITIAL_PRICE;
  return multiplied;
}
