import { BPS_DENOMINATOR, MINE_PRICE_DECAY_PERIOD, PREVIOUS_MINER_BPS, WAD } from './constants.js';
import { assertNonNegative, assertPositive, mulDiv } from './integer.js';

export interface MiningCurveConfig {
  readonly initialTps: bigint;
  readonly halvingAmount: bigint;
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

/** Returns the global TPS assigned at the next handoff, before dividing it across sixteen fixed slots. */
export function miningRateAt(economicallyMined: bigint, config: MiningCurveConfig): bigint {
  assertNonNegative(economicallyMined, 'economicallyMined');
  assertPositive(config.initialTps, 'initialTps');
  assertPositive(config.halvingAmount, 'halvingAmount');
  assertPositive(config.tailTps, 'tailTps');
  if (config.tailTps > config.initialTps) throw new RangeError('tailTps must not exceed initialTps');

  let halvings = 0n;
  let nextThreshold = config.halvingAmount;
  while (economicallyMined >= nextThreshold) {
    halvings += 1n;
    const shifted = config.initialTps >> halvings;
    if (shifted <= config.tailTps) return config.tailTps;
    nextThreshold += config.halvingAmount >> halvings;
  }

  const shifted = config.initialTps >> halvings;
  return shifted <= config.tailTps ? config.tailTps : shifted;
}

/** Quotes fixed per-slot tenure accrual; thresholds never reprice an occupied slot. */
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
