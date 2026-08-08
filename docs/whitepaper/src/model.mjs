/**
 * Economics behind the whitepaper figures.
 *
 * Every constant and every rule here mirrors the committed reference model in
 * `packages/simulations` so the paper's charts cannot drift away from the model the
 * repository already tests. Integer rules use bigint and reproduce the same sequential
 * flooring the model applies; only chart geometry is allowed to become a float.
 */

const WAD = 10n ** 18n;
const BPS = 10_000n;

export const constants = {
  maxCumulativeMint: 1_000_000_000n * WAD,
  genesisLiquidity: 20_000_000n * WAD,
  get miningAllocation() {
    return this.maxCumulativeMint - this.genesisLiquidity;
  },
  /** floor(WAD * 2^(-1/1460)) — a 1,460-day (four-year) half-life. */
  dailyDecayWad: 999_525_354_337_060_160n,
  halfLifeDays: 1460,
  /**
   * The signal-reward share of a completed normal acquisition, at launch. Adjustable
   * through timelocked governance and capped, so the Fund always keeps the majority.
   */
  signalRewardBps: 1_000n,
  maxSignalRewardBps: 5_000n,
  auction: {
    minEpochPeriodSeconds: 3_600,
    maxEpochPeriodSeconds: 365 * 86_400,
    minPriceMultiplierWad: 1_100_000_000_000_000_000n,
    maxPriceMultiplierWad: 3n * WAD,
  },
};

function mulDiv(a, b, denominator) {
  return (a * b) / denominator;
}

/**
 * floor(allocation * (1 - 2^(-1/1460))).
 *
 * This is the derivation the reference model uses, and it is the reason the schedule is
 * exactly self-funding: the infinite sum of a geometric series with ratio d and first
 * term A(1-d) is exactly A. The mining allocation is the sum of the whole schedule.
 */
export function initialDailyEmission(allocation = constants.miningAllocation) {
  // 2^(-1/1460) to 60 significant digits, computed with exp/log at extended precision.
  // Reproduced here as an exact rational bound so the result is deterministic.
  const decayComplementX54 = 474_645_662_939_839_603_777_555_401_729_090_269_549_790_568_890_158n;
  return mulDiv(allocation, decayComplementX54, 10n ** 54n);
}

export const initialEmission = initialDailyEmission();

/** Format a WAD-scaled bigint as a decimal string with the requested fraction digits. */
export function formatWad(value, fractionDigits = 18) {
  const whole = value / WAD;
  const fraction = (value % WAD).toString().padStart(18, '0').slice(0, fractionDigits);
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fractionDigits === 0 ? grouped : `${grouped}.${fraction}`;
}

/**
 * The exact daily schedule, applying the same sequential floor the contract applies:
 * `scheduled = floor(scheduled * decay / WAD)` once per day.
 */
export function emissionSchedule(days) {
  const series = [];
  let scheduled = initialEmission;
  let cumulative = 0n;

  for (let day = 0; day < days; day += 1) {
    cumulative += scheduled;
    series.push({ day: day + 1, daily: scheduled, cumulative });
    scheduled = mulDiv(scheduled, constants.dailyDecayWad, WAD);
  }

  return series;
}

/** Whole-token float view of the schedule, sampled for plotting. */
export function emissionCurve({ years = 16, samplesPerYear = 12 } = {}) {
  const days = Math.round(years * 365);
  const schedule = emissionSchedule(days);
  const step = Math.max(1, Math.round(365 / samplesPerYear));
  const allocation = Number(constants.miningAllocation / WAD);

  const points = [];
  for (let index = 0; index < schedule.length; index += step) {
    const entry = schedule[index];
    points.push({
      years: entry.day / 365,
      daily: Number(entry.daily / 10n ** 12n) / 1e6,
      cumulative: Number(entry.cumulative / 10n ** 15n) / 1e3,
      emittedShare: Number(entry.cumulative / 10n ** 12n) / 1e6 / allocation,
    });
  }

  const last = schedule.at(-1);
  points.push({
    years: last.day / 365,
    daily: Number(last.daily / 10n ** 12n) / 1e6,
    cumulative: Number(last.cumulative / 10n ** 15n) / 1e3,
    emittedShare: Number(last.cumulative / 10n ** 12n) / 1e6 / allocation,
  });

  return points;
}

/** Milestones worth stating in prose: the schedule halves every four years, forever. */
export function emissionMilestones(yearMarks = [1, 4, 8, 12, 16]) {
  const schedule = emissionSchedule(Math.max(...yearMarks) * 365);
  const allocation = constants.miningAllocation;

  return yearMarks.map((years) => {
    const entry = schedule[years * 365 - 1];
    return {
      years,
      dailyEmission: Number(entry.daily / 10n ** 12n) / 1e6,
      cumulative: entry.cumulative,
      sharePercent: Number((entry.cumulative * 10_000n) / allocation) / 100,
    };
  });
}

/**
 * The mining market.
 *
 * A day's emission `E` is split across that day's contributions, so a miner's average
 * cost is `C / E` USDG per GBX regardless of who contributed. The break-even point is
 * where that average cost meets the market price `P`, i.e. where `C = P x E`.
 */
export function miningMarket({ dailyEmission, gbxPrice, maxContribution }) {
  const breakEven = gbxPrice * dailyEmission;
  const points = [];
  const steps = 120;

  for (let index = 1; index <= steps; index += 1) {
    const contributed = (maxContribution * index) / steps;
    points.push({
      contributed,
      impliedCost: contributed / dailyEmission,
      marginPerGbx: gbxPrice - contributed / dailyEmission,
    });
  }

  return { breakEven, gbxPrice, dailyEmission, points };
}

/**
 * The oracleless auction.
 *
 * `price_at = init - floor(init * elapsed / period)` — the target-asset payment a filler
 * must hand over decays linearly to zero across the epoch. After a fill at payment `p`,
 * the next epoch opens at `p x multiplier`, floored at `minInitPrice`. That ratchet is
 * what lets repeated auctions track a market price without the core reading an oracle.
 */
export function auctionQuote({ initPrice, elapsedSeconds, epochPeriod }) {
  return initPrice - mulDiv(initPrice, BigInt(elapsedSeconds), BigInt(epochPeriod));
}

export function nextInitPrice({ paymentAmount, priceMultiplierWad, minInitPrice }) {
  const raised = mulDiv(paymentAmount, priceMultiplierWad, WAD);
  return raised > minInitPrice ? raised : minInitPrice;
}

/** A single epoch's decay curve, sampled for plotting. */
export function auctionCurve({ initPrice, epochPeriod, samples = 96 }) {
  const points = [];
  for (let index = 0; index <= samples; index += 1) {
    const elapsed = Math.round((epochPeriod * index) / samples);
    points.push({
      elapsed,
      hours: elapsed / 3600,
      payment: Number(auctionQuote({ initPrice, elapsedSeconds: elapsed, epochPeriod })) / 1e18,
    });
  }
  return points;
}

/**
 * Several epochs in sequence, showing the ratchet converging on a fair value.
 *
 * `fairValue` is the target-asset amount the market actually considers equal to the
 * Strategy's USDG. A rational filler waits until the required payment drops to it.
 *
 * Fill times come back as a fraction of the epoch rather than in seconds, so the epoch
 * period itself does not enter the calculation — the caller supplies it only for the axis.
 */
export function auctionRatchet({ initPrice, priceMultiplierWad, minInitPrice, fairValue, epochs }) {
  const timeline = [];
  let opening = initPrice;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const fills = opening > fairValue;
    // Time at which the decaying quote first reaches the market's fair value.
    const fillFraction = fills ? Number(opening - fairValue) / Number(opening) : 0;
    const payment = fills ? fairValue : 0n;

    timeline.push({
      epoch,
      opening,
      fills,
      fillFraction,
      payment,
      openingTokens: Number(opening) / 1e18,
      paymentTokens: Number(payment) / 1e18,
    });

    opening = fills
      ? nextInitPrice({ paymentAmount: payment, priceMultiplierWad, minInitPrice })
      : nextInitPrice({ paymentAmount: opening, priceMultiplierWad: WAD / 2n, minInitPrice });
  }

  return timeline;
}

/**
 * Path dependence.
 *
 * Signals only steer the next distribution, so the Fund's composition is the running sum
 * of every past signal distribution rather than a picture of the current one. The input
 * here is an illustrative signal history, not a projection of real behaviour.
 */
export function basketFormation({ assets, history, revenuePerPeriod }) {
  const holdings = assets.map(() => 0);
  const periods = [];

  history.forEach((weights, index) => {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    weights.forEach((weight, assetIndex) => {
      holdings[assetIndex] += (revenuePerPeriod * weight) / total;
    });
    periods.push({
      period: index + 1,
      signal: weights.map((weight) => weight / total),
      holdings: [...holdings],
      total: holdings.reduce((sum, value) => sum + value, 0),
    });
  });

  return periods;
}

/** Redemption: `payout_j = floor(balance_j * burned / supplyBeforeBurn)` per selected asset. */
export function previewRedemption({ balances, burned, supplyBeforeBurn }) {
  return balances.map((balance) => mulDiv(balance, burned, supplyBeforeBurn));
}

/** Split a completed acquisition into its Fund share and its signal-reward share. */
export function splitAcquisition({ received, hasEligibleSignalers }) {
  const signalShare = hasEligibleSignalers ? mulDiv(received, constants.signalRewardBps, BPS) : 0n;
  return { fundShare: received - signalShare, signalShare };
}
