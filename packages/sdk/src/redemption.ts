import { decodeFunctionResult, getAddress, parseEventLogs, type Address, type Hex, type Log } from 'viem';
import { z } from 'zod';

import { gumBallVaultAbi } from './abis.js';
import { addressSchema, tokenDecimalsSchema, unsignedBigIntSchema } from './validation.js';

export interface RedemptionAssetMetadata {
  readonly token: Address;
  readonly decimals: number;
  readonly symbol?: string;
}

export interface RedemptionAmount extends RedemptionAssetMetadata {
  readonly amountRaw: bigint;
}

const metadataSchema = z.object({
  decimals: tokenDecimalsSchema,
  symbol: z.string().min(1).optional(),
  token: addressSchema,
});

/** Decodes eth_call/simulateContract return data for GumBallVault.redeem and binds each raw amount to token metadata. */
export function decodeMultiAssetRedemptionResult(
  returnData: Hex,
  assets: readonly RedemptionAssetMetadata[],
): readonly RedemptionAmount[] {
  const normalized = assets.map((asset) => metadataSchema.parse(asset));
  if (new Set(normalized.map(({ token }) => token.toLowerCase())).size !== normalized.length) {
    throw new RangeError('redemption metadata contains duplicate tokens');
  }
  const amounts = decodeFunctionResult({ abi: gumBallVaultAbi, functionName: 'redeem', data: returnData });
  if (amounts.length !== normalized.length) {
    throw new RangeError(`redemption returned ${amounts.length} amounts for ${normalized.length} assets`);
  }
  return normalized.map((asset, index) => ({
    amountRaw: unsignedBigIntSchema.parse(amounts[index]),
    decimals: asset.decimals,
    token: asset.token,
    ...(asset.symbol === undefined ? {} : { symbol: asset.symbol }),
  }));
}

export interface DecodedRedemptionReceipt {
  readonly owner: Address;
  readonly receiver: Address;
  readonly shares: bigint;
  readonly supplyBefore: bigint;
  readonly amounts: readonly Readonly<{ token: Address; amountRaw: bigint }>[];
}

/** Decodes the complete receipt-level redemption from canonical vault events, rejecting ambiguous or incomplete logs. */
export function decodeRedemptionReceipt(logs: readonly Log[], vault?: Address): DecodedRedemptionReceipt {
  const normalizedVault = vault === undefined ? undefined : getAddress(vault).toLowerCase();
  const selected =
    normalizedVault === undefined ? logs : logs.filter((log) => log.address.toLowerCase() === normalizedVault);
  const events = parseEventLogs({ abi: gumBallVaultAbi, logs: [...selected], strict: true });
  const summaries = events.filter((event) => event.eventName === 'GumBallVault__Redeemed');
  if (summaries.length !== 1)
    throw new RangeError(`expected exactly one redemption summary, received ${summaries.length}`);
  const summary = summaries[0]!;
  const assetEvents = events.filter((event) => event.eventName === 'GumBallVault__AssetRedeemed');
  const amounts = assetEvents.map((event) => ({
    amountRaw: unsignedBigIntSchema.parse(event.args.amount),
    token: addressSchema.parse(event.args.asset),
  }));
  if (new Set(amounts.map(({ token }) => token.toLowerCase())).size !== amounts.length) {
    throw new RangeError('receipt contains duplicate redeemed-asset events');
  }
  return {
    amounts,
    owner: addressSchema.parse(summary.args.owner),
    receiver: addressSchema.parse(summary.args.receiver),
    shares: unsignedBigIntSchema.parse(summary.args.shares),
    supplyBefore: unsignedBigIntSchema.parse(summary.args.supplyBefore),
  };
}
