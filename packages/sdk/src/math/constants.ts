/** Fixed-point scale used for normalized token amounts, prices, and rates. */
export const WAD = 10n ** 18n;

/** High-precision scale used by allocation and manager-reward accumulators. */
export const ACCUMULATOR_PRECISION = 10n ** 27n;

export const BPS_DENOMINATOR = 10_000n;

export const MAX_CUMULATIVE_MINT = 1_000_000_000n * WAD;
export const GENESIS_LIQUIDITY_ALLOCATION = 20_000_000n * WAD;
export const GENESIS_TOTAL_SUPPLY = GENESIS_LIQUIDITY_ALLOCATION;
export const FUNDRAISER_DISTRIBUTION_ALLOCATION = MAX_CUMULATIVE_MINT - GENESIS_TOTAL_SUPPLY;

/**
 * floor((1 - 2^(-1 / 1460)) * 1e54). The extra precision preserves the real
 * half-life epoch-zero derivation instead of approximating it with 1e18 - DAILY_DECAY_WAD.
 */
export const HALF_LIFE_DECAY_COMPLEMENT_X54 = 474_645_662_939_839_603_777_555_401_729_090_269_549_790_568_890_158n;
export const HALF_LIFE_DERIVATION_PRECISION = 10n ** 54n;

/** Exact wei-floor of 980M GBX multiplied by the real four-year daily decay complement. */
export const INITIAL_DAILY_SCHEDULED_EMISSION =
  (FUNDRAISER_DISTRIBUTION_ALLOCATION * HALF_LIFE_DECAY_COMPLEMENT_X54) / HALF_LIFE_DERIVATION_PRECISION;

/** 2^(-1 / 1460), rounded to 18 decimal places as fixed by the specification. */
export const DAILY_DECAY_WAD = 999_525_354_337_060_160n;

export const MIN_AUCTION_EPOCH_PERIOD = 3_600n;
export const MAX_AUCTION_EPOCH_PERIOD = 365n * 86_400n;
export const MIN_AUCTION_PRICE_MULTIPLIER = 1_100_000_000_000_000_000n;
export const MAX_AUCTION_PRICE_MULTIPLIER = 3n * WAD;
export const ABS_MIN_AUCTION_INIT_PRICE = 1_000_000n;
export const ABS_MAX_AUCTION_INIT_PRICE = (1n << 192n) - 1n;
