import { GENESIS_LIQUIDITY_ALLOCATION, GENESIS_MINER_ALLOCATION, GENESIS_TOTAL_SUPPLY, WAD } from './constants.js';
import { normalizeRawTokenAmountToWad } from './decimals.js';
import { assertNonNegative, assertPositive, mulDiv, mulDivUp } from './integer.js';

export interface GenesisQuote {
  readonly communityUSDGRaw: bigint;
  readonly requiredSponsorUSDGRaw: bigint;
  readonly totalGenesisAssetsUSDGRaw: bigint;
  readonly totalGenesisSupplyGBXRaw: bigint;
  readonly genesisPriceWad: bigint;
  readonly backingPerGBXWad: bigint;
  readonly usdGDecimals: number;
}

/** Rounds upward so atomic-unit division can never make the LP allocation underbacked. */
export function requiredSponsorUSDGRaw(communityUSDGRaw: bigint): bigint {
  assertNonNegative(communityUSDGRaw, 'communityUSDGRaw');
  return mulDivUp(communityUSDGRaw, GENESIS_LIQUIDITY_ALLOCATION, GENESIS_MINER_ALLOCATION);
}

export function quoteGenesis(communityUSDGRaw: bigint, usdGDecimals: number): GenesisQuote {
  assertNonNegative(communityUSDGRaw, 'communityUSDGRaw');
  const communityUSDGWad = normalizeRawTokenAmountToWad(communityUSDGRaw, usdGDecimals, 'communityUSDGRaw');
  const requiredSponsor = requiredSponsorUSDGRaw(communityUSDGRaw);
  const totalAssetsRaw = communityUSDGRaw + requiredSponsor;
  const totalAssetsWad = normalizeRawTokenAmountToWad(totalAssetsRaw, usdGDecimals, 'totalGenesisAssetsUSDGRaw');

  return {
    communityUSDGRaw,
    requiredSponsorUSDGRaw: requiredSponsor,
    totalGenesisAssetsUSDGRaw: totalAssetsRaw,
    totalGenesisSupplyGBXRaw: GENESIS_TOTAL_SUPPLY,
    genesisPriceWad: mulDiv(communityUSDGWad, WAD, GENESIS_MINER_ALLOCATION),
    backingPerGBXWad: mulDiv(totalAssetsWad, WAD, GENESIS_TOTAL_SUPPLY),
    usdGDecimals,
  };
}

export function estimateGenesisClaim(participantContribution: bigint, totalCommunityUSDG: bigint): bigint {
  assertNonNegative(participantContribution, 'participantContribution');
  assertPositive(totalCommunityUSDG, 'totalCommunityUSDG');
  if (participantContribution > totalCommunityUSDG) {
    throw new RangeError('participantContribution must not exceed totalCommunityUSDG');
  }
  return mulDiv(participantContribution, GENESIS_MINER_ALLOCATION, totalCommunityUSDG);
}
