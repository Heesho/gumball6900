import { BPS_DENOMINATOR, MINE_PRICE_DECAY_PERIOD, PREVIOUS_MINER_BPS, WAD } from './constants.js';
import { assertNonNegative, assertPositive, mulDiv } from './integer.js';

export interface MiningCurveConfig {
  readonly initialUps: bigint;
  readonly halvingAmount: bigint;
  readonly tailUps: bigint;
}

export interface MiningAccrualInput {
  readonly elapsedSeconds: bigint;
  readonly slotUps: readonly bigint[];
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

/** Returns the global rate assigned at the next handoff, before dividing it by current capacity. */
export function miningRateAt(totalMined: bigint, config: MiningCurveConfig): bigint {
  assertNonNegative(totalMined, 'totalMined');
  assertPositive(config.initialUps, 'initialUps');
  assertPositive(config.halvingAmount, 'halvingAmount');
  assertPositive(config.tailUps, 'tailUps');
  if (config.tailUps > config.initialUps) throw new RangeError('tailUps must not exceed initialUps');

  let halvings = 0n;
  let nextThreshold = config.halvingAmount;
  while (totalMined >= nextThreshold) {
    halvings += 1n;
    const shifted = config.initialUps >> halvings;
    if (shifted <= config.tailUps) return config.tailUps;
    nextThreshold += config.halvingAmount >> halvings;
  }

  const shifted = config.initialUps >> halvings;
  return shifted <= config.tailUps ? config.tailUps : shifted;
}

/** Mirrors checkpointing fixed per-slot tenure rates; thresholds never reprice an occupied slot. */
export function quoteMiningAccrual(input: MiningAccrualInput): MiningAccrualQuote {
  assertNonNegative(input.elapsedSeconds, 'elapsedSeconds');
  const slotEmissions = input.slotUps.map((ups, index) => {
    assertNonNegative(ups, `slotUps[${index}]`);
    return ups * input.elapsedSeconds;
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

/** Quotes the exact 80/20 replacement split; an empty slot routes its complete payment to Resonance. */
export function quoteMiningPayment(payment: bigint, hasPreviousMiner: boolean): MiningPaymentQuote {
  assertNonNegative(payment, 'payment');
  const previousMinerAmount = hasPreviousMiner ? mulDiv(payment, PREVIOUS_MINER_BPS, BPS_DENOMINATOR) : 0n;
  return { payment, previousMinerAmount, resonanceAmount: payment - previousMinerAmount };
}

/** Computes the next slot starting price using Mine's floor multiplication and immutable clamps. */
export function nextMiningInitialPrice(
  payment: bigint,
  priceMultiplier: bigint,
  minimumInitialPrice: bigint,
  maximumInitialPrice: bigint,
): bigint {
  assertNonNegative(payment, 'payment');
  assertPositive(priceMultiplier, 'priceMultiplier');
  assertPositive(minimumInitialPrice, 'minimumInitialPrice');
  assertPositive(maximumInitialPrice, 'maximumInitialPrice');
  const multiplied = mulDiv(payment, priceMultiplier, WAD);
  if (multiplied < minimumInitialPrice) return minimumInitialPrice;
  if (multiplied > maximumInitialPrice) return maximumInitialPrice;
  return multiplied;
}
