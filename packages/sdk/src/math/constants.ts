/** Fixed-point scale used for normalized token amounts, prices, and rates. */
export const WAD = 10n ** 18n;

/** High-precision scale used by allocation and reward accumulators. */
export const ACCUMULATOR_PRECISION = 10n ** 27n;

export const BPS_DENOMINATOR = 10_000n;
/** Initial global share of Strategy payments classified as paired-Bribe rewards. */
export const DEFAULT_STRATEGY_BRIBE_BPS = 1_000n;
/** Hard governance ceiling for the global Strategy-payment Bribe share. */
export const MAX_STRATEGY_BRIBE_BPS = 2_000n;
/** @deprecated The Strategy Bribe share is mutable; use DEFAULT_STRATEGY_BRIBE_BPS for its initial value. */
export const STRATEGY_BRIBE_BPS = DEFAULT_STRATEGY_BRIBE_BPS;
/** @deprecated The Strategy Fund share is mutable and always equals BPS_DENOMINATOR minus the current Bribe share. */
export const STRATEGY_FUND_BPS = BPS_DENOMINATOR - DEFAULT_STRATEGY_BRIBE_BPS;

/** The only GBX created before the immutable Mine is bound. */
export const GENESIS_LIQUIDITY_ALLOCATION = 20_000_000n * WAD;

export const PREVIOUS_MINER_BPS = 8_000n;
export const RESONANCE_REVENUE_BPS = BPS_DENOMINATOR - PREVIOUS_MINER_BPS;
export const MINE_PRICE_DECAY_PERIOD = 3_600n;
export const MINE_SLOT_COUNT = 16n;
export const MINE_PRICE_MULTIPLIER = 2n;
export const MINE_MINIMUM_INITIAL_PRICE = 1_000_000n;
export const MINE_MAX_INITIAL_PRICE = (1n << 192n) - 1n;
export const MINE_INITIAL_TPS = 64n * WAD;
/** Provisional fixed interval between prospective global-rate halvings. */
export const MINE_HALVING_PERIOD = 69n * 86_400n;
export const MINE_TAIL_TPS = WAD;
/** Maximum UTF-8 byte length accepted for a Mine handoff message. */
export const MINE_MAX_MESSAGE_BYTES = 280;

export const MIN_AUCTION_EPOCH_PERIOD = 3_600n;
export const MAX_AUCTION_EPOCH_PERIOD = 365n * 86_400n;
export const MIN_AUCTION_PRICE_MULTIPLIER = 1_100_000_000_000_000_000n;
export const MAX_AUCTION_PRICE_MULTIPLIER = 3n * WAD;
export const ABS_MIN_AUCTION_INIT_PRICE = 1_000_000n;
export const ABS_MAX_AUCTION_INIT_PRICE = (1n << 192n) - 1n;
