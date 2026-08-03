import {
  acquisitionStrategyAbi,
  buybackStrategyAbi,
  gumBallVaultAbi,
  pinBlockSnapshot,
  readRedemptionPreview,
  readStrategyAuctionQuote,
  readSupplyView,
  revalidateBlockSnapshot,
  type AuctionQuote,
} from '@gumball-6900/sdk';
import { getAddress, type Address, type Hash, type PublicClient } from 'viem';

import { readLiveProtocolOverviewAtBlock } from './live-protocol-overview';
import type { LiveRuntimeDeployment } from './runtime-types';

export interface AuctionPreflightSelection {
  readonly kind: 'acquisition' | 'buyback';
  readonly strategy: Address;
}

export interface PinnedRedemptionOutput {
  readonly amount: bigint;
  readonly decimals: number;
  readonly isStockToken: boolean;
  readonly symbol: string;
  readonly token: Address;
}

export interface PinnedRedemptionPreflight {
  readonly blockHash: Hash;
  readonly blockNumber: bigint;
  readonly outputs: readonly PinnedRedemptionOutput[];
  readonly shares: bigint;
  readonly totalSupply: bigint;
}

export interface PinnedAuctionPreflight extends AuctionQuote {
  readonly blockHash: Hash;
  readonly registryIndex: number;
  readonly symbol: string;
  readonly targetToken: Address;
  readonly usdGToken: Address;
}

export type FinancialPreflightErrorCode =
  | 'auction-budget'
  | 'auction-expired'
  | 'auction-inactive'
  | 'auction-lot'
  | 'auction-maximum'
  | 'auction-not-expired';

/** A bounded, presentation-safe failure produced after a canonical pinned read. */
export class FinancialPreflightError extends Error {
  readonly code: FinancialPreflightErrorCode;
  readonly userMessage: string;

  constructor(code: FinancialPreflightErrorCode, userMessage: string) {
    super(userMessage);
    this.name = 'FinancialPreflightError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * Reads supply and every raw redemption output at one block, revalidates that block hash,
 * and rejects any token, order, duplicate, or parallel-array drift from the signed Lens/registry graph.
 */
export async function readPinnedRedemptionPreflight(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  shares: bigint,
): Promise<PinnedRedemptionPreflight> {
  const snapshot = await pinBlockSnapshot(client);
  const options = { atBlock: snapshot.blockNumber, expectedBlockHash: snapshot.blockHash } as const;
  const [preview, supply, overview] = await Promise.all([
    readRedemptionPreview(client, runtime.addresses.gumBallLens, shares, options),
    readSupplyView(client, runtime.addresses.gumBallLens, options),
    readLiveProtocolOverviewAtBlock(client, runtime, { hash: snapshot.blockHash, number: snapshot.blockNumber }),
  ]);

  if (preview.blockNumber !== snapshot.blockNumber || supply.blockNumber !== snapshot.blockNumber) {
    throw new TypeError('redemption preflight returned mixed block numbers');
  }
  if (preview.tokens.length !== overview.assets.length) {
    throw new TypeError('redemption preflight asset count does not match the bounded registry');
  }
  if (new Set(preview.tokens.map((token) => token.toLowerCase())).size !== preview.tokens.length) {
    throw new TypeError('redemption preflight contains duplicate tokens');
  }

  const outputs = overview.assets.map((asset, index): PinnedRedemptionOutput => {
    const token = preview.tokens[index];
    const amount = preview.amountsOutRaw[index];
    if (token === undefined || amount === undefined || !sameAddress(token, asset.token)) {
      throw new TypeError(`redemption preflight token order does not match the registry at ${asset.symbol}`);
    }
    return {
      amount,
      decimals: asset.decimals,
      isStockToken: asset.isStockToken,
      symbol: asset.symbol,
      token: getAddress(token),
    };
  });

  if (shares > supply.totalSupply) throw new TypeError('redemption shares exceed the pinned total supply');
  await revalidateBlockSnapshot(client, snapshot);
  return {
    blockHash: snapshot.blockHash,
    blockNumber: snapshot.blockNumber,
    outputs,
    shares,
    totalSupply: supply.totalSupply,
  };
}

/**
 * Reads the complete reverse-Dutch quote at one canonical block and verifies the strategy's
 * immutable bindings against the bounded Lens/registry graph and signed core deployment.
 */
export async function readPinnedAuctionPreflight(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  selection: AuctionPreflightSelection,
  usdGAmountRaw: bigint,
): Promise<PinnedAuctionPreflight> {
  const snapshot = await pinBlockSnapshot(client);
  const options = { atBlock: snapshot.blockNumber, expectedBlockHash: snapshot.blockHash } as const;
  const strategy = getAddress(selection.strategy);
  const overview = await readLiveProtocolOverviewAtBlock(client, runtime, {
    hash: snapshot.blockHash,
    number: snapshot.blockNumber,
  });
  const registryStrategy = overview.strategies.find((candidate) => sameAddress(candidate.strategy, strategy));
  if (registryStrategy === undefined) throw new TypeError('auction strategy is absent from the bounded registry');
  if (registryStrategy.kind !== selection.kind) {
    throw new TypeError('auction strategy kind does not match the pinned registry');
  }
  if (selection.kind === 'buyback') {
    if (registryStrategy.genesisSymbol !== 'BURN' || !sameAddress(registryStrategy.strategy, runtime.strategies.BURN)) {
      throw new TypeError('auction buyback is not the signed canonical burn strategy');
    }
  } else if (registryStrategy.kind !== 'acquisition') {
    throw new TypeError('auction strategy is not a registered acquisition strategy');
  }

  const registryAsset =
    selection.kind === 'acquisition'
      ? overview.assets.find(
          (candidate) =>
            sameAddress(candidate.token, registryStrategy.token) && sameAddress(candidate.strategy, strategy),
        )
      : undefined;
  let expectedTarget: Address;
  let expectedTargetDecimals: number;
  if (selection.kind === 'buyback') {
    expectedTarget = runtime.assets.GBX;
    expectedTargetDecimals = runtime.assetMetadata.GBX.decimals;
  } else {
    if (registryAsset === undefined) {
      throw new TypeError('auction strategy has no matching asset in the pinned registry');
    }
    expectedTarget = registryAsset.token;
    expectedTargetDecimals = registryAsset.decimals;
  }
  const abi = selection.kind === 'buyback' ? buybackStrategyAbi : acquisitionStrategyAbi;
  const targetFunction = selection.kind === 'buyback' ? 'GBX' : 'TARGET_TOKEN';
  const [quote, targetTokenRaw, strategyVaultRaw, strategyRegistryRaw, strategyVoterRaw, vaultUSDGRaw] =
    await Promise.all([
      readStrategyAuctionQuote(client, { kind: selection.kind, strategy, usdGAmountRaw }, options),
      client.readContract({
        abi,
        address: strategy,
        blockNumber: snapshot.blockNumber,
        functionName: targetFunction,
      }),
      client.readContract({
        abi,
        address: strategy,
        blockNumber: snapshot.blockNumber,
        functionName: 'GUM_BALL_VAULT',
      }),
      client.readContract({
        abi,
        address: strategy,
        blockNumber: snapshot.blockNumber,
        functionName: 'ASSET_REGISTRY',
      }),
      client.readContract({
        abi,
        address: strategy,
        blockNumber: snapshot.blockNumber,
        functionName: 'ALLOCATION_VOTER',
      }),
      client.readContract({
        abi: gumBallVaultAbi,
        address: runtime.addresses.gumBallVault,
        blockNumber: snapshot.blockNumber,
        functionName: 'USDG',
      }),
    ]);
  const targetToken = getAddress(targetTokenRaw as Address);
  const strategyVault = getAddress(strategyVaultRaw as Address);
  const strategyRegistry = getAddress(strategyRegistryRaw as Address);
  const strategyVoter = getAddress(strategyVoterRaw as Address);
  const usdGToken = getAddress(vaultUSDGRaw as Address);

  if (quote.blockNumber !== snapshot.blockNumber) throw new TypeError('auction preflight returned a mixed block');
  if (
    !sameAddress(quote.strategy, strategy) ||
    quote.kind !== selection.kind ||
    quote.usdGAmountRaw !== usdGAmountRaw
  ) {
    throw new TypeError('auction preflight identity does not match the requested strategy');
  }
  if (
    !sameAddress(targetToken, expectedTarget) ||
    !sameAddress(strategyVault, runtime.addresses.gumBallVault) ||
    !sameAddress(usdGToken, runtime.assets.USDG) ||
    !sameAddress(strategyRegistry, runtime.addresses.assetRegistry) ||
    !sameAddress(strategyVoter, runtime.addresses.allocationVoter)
  ) {
    throw new TypeError('auction preflight immutable binding does not match the pinned protocol graph');
  }
  if (quote.targetDecimals !== expectedTargetDecimals || quote.usdGDecimals !== runtime.assetMetadata.USDG.decimals) {
    throw new TypeError('auction preflight token decimals do not match the manifest');
  }

  await revalidateBlockSnapshot(client, snapshot);
  return {
    ...quote,
    blockHash: snapshot.blockHash,
    registryIndex: registryStrategy.registryIndex,
    symbol: registryStrategy.symbol,
    targetToken,
    usdGToken,
  };
}

export function assertAuctionFillPreflight(preflight: PinnedAuctionPreflight, maximumTargetAmountRaw: bigint): void {
  if (preflight.fillsPaused || !preflight.isLiveStrategy) {
    throw new FinancialPreflightError(
      'auction-inactive',
      'This auction is paused or inactive. Refresh strategy state before trying again.',
    );
  }
  if (preflight.isExpired || preflight.blockTimestamp >= preflight.auctionExpiresAt) {
    throw new FinancialPreflightError(
      'auction-expired',
      'This auction has expired. Restart it permissionlessly before approving or filling.',
    );
  }
  if (preflight.usdGAmountRaw < preflight.minimumLotUSDGRaw || preflight.usdGAmountRaw > preflight.maximumLotUSDGRaw) {
    throw new FinancialPreflightError(
      'auction-lot',
      "The requested USDG amount is outside this auction's current lot bounds.",
    );
  }
  if (preflight.usdGAmountRaw > preflight.availableBudgetRaw) {
    throw new FinancialPreflightError(
      'auction-budget',
      "The requested USDG amount exceeds this strategy's current available budget.",
    );
  }
  if (maximumTargetAmountRaw < preflight.requiredTargetRaw) {
    throw new FinancialPreflightError(
      'auction-maximum',
      'The maximum token payment is below the current pinned auction quote.',
    );
  }
}

export function assertAuctionRestartPreflight(preflight: PinnedAuctionPreflight): void {
  if (!preflight.isExpired || preflight.blockTimestamp < preflight.auctionExpiresAt) {
    throw new FinancialPreflightError(
      'auction-not-expired',
      'This auction is still active and cannot be restarted before its exact expiry.',
    );
  }
}
