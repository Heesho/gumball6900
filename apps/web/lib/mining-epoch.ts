import {
  MAX_CUMULATIVE_MINT,
  estimateMiningClaim,
  minimumMiningPrice,
  quoteMiningEpoch,
  type MiningEpochQuote,
} from '@gumball-6900/sdk';

import type { CurrentMiningEpochSnapshot } from '../hooks/use-protocol-reads';

export interface MiningContributionEstimate {
  beneficiaryContributionAfter: bigint;
  estimatedBeneficiaryGBX: bigint;
  fundingBps: bigint;
  quote: MiningEpochQuote;
  totalContributedAfter: bigint;
}

export function estimateCurrentMiningContribution(
  snapshot: CurrentMiningEpochSnapshot,
  requestedAmount: bigint,
): MiningContributionEstimate {
  if (requestedAmount < 0n) throw new RangeError('requestedAmount must be non-negative');
  if (snapshot.remainingMintCapacity > MAX_CUMULATIVE_MINT) {
    throw new RangeError('remainingMintCapacity exceeds the cumulative mint cap');
  }

  const totalContributedAfter = snapshot.totalContributed + requestedAmount;
  const beneficiaryContributionAfter = snapshot.beneficiaryContribution + requestedAmount;
  const quoted = quoteMiningEpoch({
    cumulativeMinted: MAX_CUMULATIVE_MINT - snapshot.remainingMintCapacity,
    referenceMiningPrice: snapshot.referenceMiningPrice,
    scheduledEmission: snapshot.currentScheduledEmission,
    totalUSDGRaw: totalContributedAfter,
    usdGDecimals: snapshot.usdGDecimals,
  });
  const quote: MiningEpochQuote = snapshot.invalidated
    ? {
        ...quoted,
        actualEmission: 0n,
        affordableEmission: 0n,
        clearingPrice: 0n,
        fullyFunded: false,
        minimumMiningPrice: minimumMiningPrice(snapshot.referenceMiningPrice),
        nextReferenceMiningPrice: minimumMiningPrice(snapshot.referenceMiningPrice),
      }
    : quoted;
  const estimatedBeneficiaryGBX =
    totalContributedAfter === 0n || quote.actualEmission === 0n
      ? 0n
      : estimateMiningClaim(beneficiaryContributionAfter, totalContributedAfter, quote.actualEmission);
  const fundingBps =
    quote.scheduledEmission === 0n
      ? 0n
      : (quote.actualEmission * 10_000n) / quote.scheduledEmission > 10_000n
        ? 10_000n
        : (quote.actualEmission * 10_000n) / quote.scheduledEmission;

  return {
    beneficiaryContributionAfter,
    estimatedBeneficiaryGBX,
    fundingBps,
    quote,
    totalContributedAfter,
  };
}

export function miningSecondsRemaining(snapshot: CurrentMiningEpochSnapshot): number {
  if (snapshot.endTime <= snapshot.blockTimestamp) return 0;
  const remaining = snapshot.endTime - snapshot.blockTimestamp;
  if (remaining > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError('mining epoch duration exceeds safe display range');
  return Number(remaining);
}
