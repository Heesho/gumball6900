/**
 * Every number the one-pager prints, derived from the whitepaper's machine-readable
 * protocol facts rather than typed by hand.
 *
 * `docs/whitepaper/src/protocol-facts.mjs` mirrors the production Solidity constants and
 * cross-checks them against `packages/simulations/fixtures/economic-scenarios.json`, which
 * the repository tests independently in TypeScript and Python. This module only reshapes
 * those verified values into the short strings a one-page sheet can carry, so a figure on
 * this page cannot drift away from the contracts or from the tested model.
 *
 * ADR 0024 replaced the pooled daily Fundraiser with the multislot Mine, which removed the
 * three supply figures this module used to export. There is no lifetime mint ceiling to
 * print any more: `Mine` is a permanent minter and the global rate halves toward a strictly
 * positive tail rather than toward a cap. Anything here that implies a maximum supply is a
 * bug, not a rounding choice.
 */

import { contractConstants, status } from '../../../whitepaper/src/protocol-facts.mjs';

/** Thousands separators, for the one figure printed at full width. */
function grouped(value) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Basis points as the whole percentage a reader recognises. */
function percentFromBps(bps) {
  return `${bps / 100}%`;
}

export const numbers = {
  /** GBX.sol GENESIS_LIQUIDITY_ALLOCATION, minted once in the constructor. */
  genesisLiquidity: grouped(contractConstants.gbx.genesisLiquidityTokens),
  /** The same figure, abbreviated for the reasons strip. */
  genesisLiquidityShort: `${contractConstants.gbx.genesisLiquidityTokens / 1_000_000}M`,
  /** Mine.sol PREVIOUS_MINER_BPS: the displaced miner's share of a nonempty handoff. */
  minerShare: percentFromBps(contractConstants.mine.previousMinerBps),
  /** The remainder, which is the share that reaches the fund's buying flow. */
  routedShare: percentFromBps(contractConstants.mine.resonanceBps),
  /** Mine.sol PRICE_DECAY_PERIOD, printed as the unit a reader thinks in. */
  priceDecay: `${contractConstants.mine.priceDecaySeconds / 3_600} hour`,
  /** Mine.sol MAX_CAPACITY, the permanent ceiling on concurrent slots. */
  maxSlots: contractConstants.mine.maxCapacity,
  /** BribeRouter.FUND_BPS: cumulative Strategy-payment share classified to Fund. */
  fundBoundShare: percentFromBps(contractConstants.bribeRouter.fundBps),
  /** BribeRouter.BRIBE_BPS: cumulative Strategy-payment share classified to paired-Bribe rewards. */
  bribeRewardShare: percentFromBps(contractConstants.bribeRouter.bribeBps),
  /** Bribe.sol MAX_REWARD_TOKENS, immutable and not governable. */
  maxRewardTokens: contractConstants.bribe.maxRewardTokens,
  /** Fund and LiquidityPosition inherit no ownership and expose no withdrawal surface. */
  fundAdministrators: 0,
};

export const commits = {
  contracts: status.contractsCommit,
  contractsShort: status.contractsCommitShort,
  auditCandidate: status.auditCandidateCommit,
  auditCandidateShort: status.auditCandidateCommitShort,
};

export { contractConstants, status };
