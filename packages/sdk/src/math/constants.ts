/** Fixed-point scale used for normalized token amounts, prices, and rates. */
export const WAD = 10n ** 18n;

/** High-precision scale used by allocation and manager-reward accumulators. */
export const ACCUMULATOR_PRECISION = 10n ** 27n;

export const BPS_DENOMINATOR = 10_000n;

export const MAX_CUMULATIVE_MINT = 1_000_000_000n * WAD;
export const GENESIS_MINER_ALLOCATION = 80_000_000n * WAD;
export const GENESIS_LIQUIDITY_ALLOCATION = 20_000_000n * WAD;
export const GENESIS_TOTAL_SUPPLY = GENESIS_MINER_ALLOCATION + GENESIS_LIQUIDITY_ALLOCATION;
export const POST_GENESIS_EMISSION_BUDGET = 900_000_000n * WAD;

/** Exact integer selected from the specification's initial daily emission value. */
export const INITIAL_DAILY_SCHEDULED_EMISSION = 427_181_096_645_855_643_000_000n;

/** 2^(-1 / 1460), rounded to 18 decimal places as fixed by the specification. */
export const DAILY_DECAY_WAD = 999_525_354_337_060_160n;

export const MINING_REFERENCE_FLOOR_BPS = 9_500n;
export const REFERENCE_EMA_OLD_BPS = 8_000n;
export const REFERENCE_EMA_NEW_BPS = 2_000n;
export const REFERENCE_MAX_INCREASE_BPS = 15_000n;

export const AUCTION_DURATION_SECONDS = 86_400n;
export const AUCTION_START_RATE_BPS = 12_500n;
export const AUCTION_FLOOR_RATE_BPS = 8_000n;

export const MANAGER_REWARD_BPS = 200n;
export const VAULT_ACQUISITION_BPS = BPS_DENOMINATOR - MANAGER_REWARD_BPS;
