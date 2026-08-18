/** Fixed-point scale used for normalized token amounts, prices, and rates. */
export const WAD = 10n ** 18n;

/** High-precision scale used by allocation and reward accumulators. */
export const ACCUMULATOR_PRECISION = 10n ** 27n;

export const BPS_DENOMINATOR = 10_000n;
export const STRATEGY_FUND_BPS = 9_000n;
export const STRATEGY_BRIBE_BPS = 1_000n;

/** The only GBX created before the immutable Mine is bound. */
export const GENESIS_LIQUIDITY_ALLOCATION = 20_000_000n * WAD;

export const PREVIOUS_MINER_BPS = 8_000n;
export const RESONANCE_REVENUE_BPS = BPS_DENOMINATOR - PREVIOUS_MINER_BPS;
export const MINE_PRICE_DECAY_PERIOD = 3_600n;
export const MINE_SLOT_COUNT = 16n;

export const MIN_AUCTION_EPOCH_PERIOD = 3_600n;
export const MAX_AUCTION_EPOCH_PERIOD = 365n * 86_400n;
export const MIN_AUCTION_PRICE_MULTIPLIER = 1_100_000_000_000_000_000n;
export const MAX_AUCTION_PRICE_MULTIPLIER = 3n * WAD;
export const ABS_MIN_AUCTION_INIT_PRICE = 1_000_000n;
export const ABS_MAX_AUCTION_INIT_PRICE = (1n << 192n) - 1n;
