'use client';

import {
  emissionControllerAbi,
  gbxAbi,
  managerRewardsAbi,
  miningClaimsAbi,
  miningPoolAbi,
  pinBlockSnapshot,
  previewRedemption,
  readGenesisView,
  readManagerRewardView,
  readMiningEpochView,
  readPendingActivationView,
  revalidateBlockSnapshot,
  stakedGbxAbi,
  type GenesisView,
} from '@gumball-6900/sdk';
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import type { Address, Hash, PublicClient } from 'viem';

import { useRuntimeDeployment } from '../components/protocol/runtime-context';
import {
  readPinnedAuctionPreflight,
  readPinnedRedemptionPreflight,
  type AuctionPreflightSelection,
  type PinnedAuctionPreflight,
  type PinnedRedemptionPreflight,
} from '../lib/financial-preflight';
import {
  canResumeContributionEpochScan,
  mapWithConcurrency,
  MAX_CLAIM_READ_CONCURRENCY,
  scanContributionEpochWindows,
  type ContributionEpochScanCheckpoint,
} from '../lib/mining-claim-discovery';
import { readLiveProtocolOverviewAtBlock } from '../lib/live-protocol-overview';
import { miningEpoch, protocolSnapshot, userSignalAccount, vaultAssets } from '../lib/read-model';
import {
  fetchManagerRewardTerminalDust,
  fetchManagerRewardTerminalDustAnchor,
  managerRewardIdentitiesFromOverview,
  validateManagerRewardTerminalDustTotals,
  type ManagerRewardTerminalDustIndex,
} from '../lib/subgraph-terminal-dust';
import { erc20TransactionAbi } from '../lib/transactions';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export type ProtocolReadSource = 'demo' | 'live' | 'live-loading' | 'live-stale' | 'rpc-fallback';

export interface LiveMiningClaimRow {
  claimable: bigint;
  contributed: bigint;
  epochId: bigint;
  expired: boolean;
  hasClaimed: boolean;
  invalidated: boolean;
  settled: boolean;
  settledAt: bigint;
}

export interface LiveMiningClaimsResult {
  readonly rows: readonly LiveMiningClaimRow[];
  readonly scanComplete: boolean;
  readonly scannedThroughBlock: bigint | null;
  readonly targetBlock: bigint;
}

export interface CurrentMiningEpochSnapshot {
  blockNumber: bigint;
  blockTimestamp: bigint;
  beneficiaryContribution: bigint;
  contributionsPaused: boolean;
  currentScheduledEmission: bigint;
  endTime: bigint;
  extensionUsed: bigint;
  invalidated: boolean;
  referenceMiningPrice: bigint;
  remainingMintCapacity: bigint;
  startTime: bigint;
  totalContributed: bigint;
  usdGDecimals: number;
  epochId: bigint;
}

export interface GenesisBootstrapSnapshot extends GenesisView {
  blockTimestamp: bigint;
}

export interface LiveManageSignalRow {
  readonly activeWeight: bigint;
  readonly pendingIncrease: bigint;
  readonly strategy: Address;
  readonly symbol: string;
}

export interface LiveManagerRewardRow {
  readonly earnedRaw: bigint;
  readonly managerRewards: Address;
  readonly receiver: Address;
  readonly rewardToken: Address;
  readonly rewardTokenDecimals: number;
  readonly strategy: Address;
  readonly symbol: string;
  readonly totalPendingTerminalDust: bigint;
}

export interface LiveManageAccountState {
  readonly activationTime: bigint;
  readonly activationsPaused: boolean;
  readonly beneficiary: Address;
  readonly blockNumber: bigint;
  readonly blockTimestamp: bigint;
  readonly gbxBalance: bigint;
  readonly rewards: readonly LiveManagerRewardRow[];
  readonly signals: readonly LiveManageSignalRow[];
  readonly stakedBalance: bigint;
}

export interface LiveStrategyStateRow {
  readonly activeWeight: bigint;
  readonly disabled: boolean;
  readonly live: boolean;
  readonly kind: 'hold-usdg' | 'acquisition' | 'buyback' | 'standalone';
  readonly strategy: Address;
  readonly symbol: string;
  readonly token: Address;
  readonly virtualUSDGBudget: bigint;
}

export interface LiveStrategyState {
  readonly blockNumber: bigint;
  readonly rows: readonly LiveStrategyStateRow[];
}

const MAX_MANAGE_READ_CONCURRENCY = 4;

export function useLiveManageAccountState() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const client = usePublicClient();
  const enabled = runtime.mode === 'live' && account.address !== undefined && client !== undefined;
  return useQuery({
    enabled,
    queryKey: [
      'live-manage-account',
      runtime.chain.id,
      runtime.manifest?.gitCommit,
      runtime.addresses?.gumBallLens,
      runtime.assets.GBX,
      account.address,
    ],
    queryFn: async (): Promise<LiveManageAccountState> => {
      if (runtime.mode !== 'live' || account.address === undefined || client === undefined) {
        throw new Error('Validated manage contracts, beneficiary, and RPC client are required.');
      }
      const pinnedBlock = await client.getBlock({ blockTag: 'latest' });
      if (pinnedBlock.hash === null) throw new Error('Pinned manage-state block did not have a hash.');
      const blockNumber = pinnedBlock.number;
      const overview = await readLiveProtocolOverviewAtBlock(client, runtime, {
        hash: pinnedBlock.hash,
        number: blockNumber,
      });
      const rewardEntries = overview.assets.filter(
        (asset) => asset.rewards.toLowerCase() !== ZERO_ADDRESS && asset.strategy.toLowerCase() !== ZERO_ADDRESS,
      );
      const [signalView, gbxBalance, rewards] = await Promise.all([
        readPendingActivationView(client, runtime.addresses.gumBallLens, account.address, pinnedBlock.timestamp, {
          atBlock: blockNumber,
          expectedBlockHash: pinnedBlock.hash,
        }),
        client.readContract({
          abi: gbxAbi,
          address: runtime.assets.GBX,
          args: [account.address],
          blockNumber,
          functionName: 'balanceOf',
        }),
        mapWithConcurrency(rewardEntries, MAX_MANAGE_READ_CONCURRENCY, async (asset) => {
          const view = await readManagerRewardView(client, asset.rewards, account.address!, {
            atBlock: blockNumber,
            expectedBlockHash: pinnedBlock.hash,
          });
          if (view.blockNumber !== blockNumber)
            throw new Error(`Manager reward ${asset.symbol} was not read at the pin.`);
          if (view.strategy.toLowerCase() !== asset.strategy.toLowerCase()) {
            throw new Error(`Manager reward ${asset.symbol} strategy does not match the registry.`);
          }
          if (view.rewardToken.toLowerCase() !== asset.token.toLowerCase()) {
            throw new Error(`Manager reward ${asset.symbol} token does not match the registry.`);
          }
          return {
            earnedRaw: view.earnedRaw,
            managerRewards: asset.rewards,
            receiver: view.receiver,
            rewardToken: view.rewardToken,
            rewardTokenDecimals: view.rewardTokenDecimals,
            strategy: view.strategy,
            symbol: asset.symbol,
            totalPendingTerminalDust: view.totalPendingTerminalDust,
          };
        }),
      ]);
      if (signalView.blockNumber !== blockNumber) throw new Error('Signal state was not read at the pin.');
      const signalsByStrategy = new Map(signalView.signals.map((signal) => [signal.strategy.toLowerCase(), signal]));
      const signals = overview.strategies.map(({ strategy, symbol }) => {
        const signal = signalsByStrategy.get(strategy.toLowerCase());
        return {
          activeWeight: signal?.activeWeight ?? 0n,
          pendingIncrease: signal?.pendingIncrease ?? 0n,
          strategy,
          symbol,
        };
      });
      await revalidateBlockSnapshot(client, { blockHash: pinnedBlock.hash, blockNumber });
      return {
        activationTime: signalView.activationTime,
        activationsPaused: signalView.activationsPaused,
        beneficiary: account.address,
        blockNumber,
        blockTimestamp: pinnedBlock.timestamp,
        gbxBalance,
        rewards,
        signals,
        stakedBalance: signalView.stakedBalance,
      };
    },
    refetchInterval: 15_000,
    refetchOnMount: 'always',
    retry: false,
    staleTime: 12_000,
  });
}

export function useLiveManagerRewardTerminalDust() {
  const runtime = useRuntimeDeployment();
  const client = usePublicClient();
  const enabled = runtime.mode === 'live' && client !== undefined;
  return useQuery({
    enabled,
    queryKey: [
      'live-manager-reward-terminal-dust',
      runtime.chain.id,
      runtime.manifest?.gitCommit,
      runtime.addresses?.gumBallLens,
      runtime.subgraphUrl,
    ],
    queryFn: async ({ signal }): Promise<ManagerRewardTerminalDustIndex> => {
      if (runtime.mode !== 'live' || client === undefined) {
        throw new Error('Validated manager-reward contracts, subgraph, and RPC client are required.');
      }
      const anchor = await fetchManagerRewardTerminalDustAnchor(runtime.subgraphUrl, { signal });
      const overview = await readLiveProtocolOverviewAtBlock(client, runtime, {
        hash: anchor.indexedBlockHash,
        number: anchor.indexedBlock,
      });
      const identities = managerRewardIdentitiesFromOverview(overview.assets);
      const index = await fetchManagerRewardTerminalDust(runtime.subgraphUrl, {
        anchor,
        chainId: runtime.chain.id,
        identities,
        signal,
      });
      const totals = await mapWithConcurrency(identities, MAX_MANAGE_READ_CONCURRENCY, async (identity) => {
        const totalPendingTerminalDust = await client.readContract({
          abi: managerRewardsAbi,
          address: identity.managerRewards,
          blockNumber: index.indexedBlock,
          functionName: 'totalPendingTerminalDust',
        });
        return { managerRewards: identity.managerRewards, totalPendingTerminalDust };
      });
      validateManagerRewardTerminalDustTotals(index, identities, totals);
      await revalidateBlockSnapshot(client, {
        blockHash: index.indexedBlockHash,
        blockNumber: index.indexedBlock,
      });
      return index;
    },
    refetchInterval: 15_000,
    refetchOnMount: 'always',
    retry: false,
    staleTime: 12_000,
  });
}

export function useLiveStrategyState() {
  const runtime = useRuntimeDeployment();
  const client = usePublicClient();
  const enabled = runtime.mode === 'live' && client !== undefined;
  return useQuery({
    enabled,
    queryKey: ['live-strategy-state', runtime.chain.id, runtime.manifest?.gitCommit, runtime.addresses?.gumBallLens],
    queryFn: async (): Promise<LiveStrategyState> => {
      if (runtime.mode !== 'live' || client === undefined) {
        throw new Error('Validated strategy contracts and RPC client are required.');
      }
      const pinnedBlock = await client.getBlock({ blockTag: 'latest' });
      if (pinnedBlock.hash === null) throw new Error('Pinned strategy-state block did not have a hash.');
      const overview = await readLiveProtocolOverviewAtBlock(client, runtime, {
        hash: pinnedBlock.hash,
        number: pinnedBlock.number,
      });
      const rows = overview.strategies.map((row) => ({
        activeWeight: row.activeWeight,
        disabled: row.voterDisabled,
        kind: row.kind,
        live: row.live,
        strategy: row.strategy,
        symbol: row.symbol,
        token: row.token,
        virtualUSDGBudget: row.virtualUSDGBudget,
      }));
      await revalidateBlockSnapshot(client, { blockHash: pinnedBlock.hash, blockNumber: pinnedBlock.number });
      return { blockNumber: pinnedBlock.number, rows };
    },
    refetchInterval: 15_000,
    retry: false,
    staleTime: 12_000,
  });
}

export function useCurrentMiningEpoch() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const client = usePublicClient();
  const enabled = runtime.mode === 'live' && runtime.addresses !== null && client !== undefined;
  return useQuery({
    enabled,
    queryKey: [
      'current-mining-epoch',
      runtime.chain.id,
      runtime.manifest?.gitCommit,
      runtime.addresses?.miningPool,
      runtime.addresses?.miningClaims,
      runtime.addresses?.emissionController,
      account.address ?? ZERO_ADDRESS,
    ],
    queryFn: async (): Promise<CurrentMiningEpochSnapshot> => {
      if (runtime.addresses === null || client === undefined) {
        throw new Error('Validated mining contracts and RPC client are required.');
      }
      const pinnedBlock = await pinBlockSnapshot(client);
      const blockNumber = pinnedBlock.blockNumber;
      const epochId = await client.readContract({
        abi: miningPoolAbi,
        address: runtime.addresses.miningPool,
        blockNumber,
        functionName: 'currentEpochId',
      });
      const [view, currentScheduledEmission, remainingMintCapacity, block] = await Promise.all([
        readMiningEpochView(
          client,
          { miningPool: runtime.addresses.miningPool, miningClaims: runtime.addresses.miningClaims },
          epochId,
          account.address ?? ZERO_ADDRESS,
          { atBlock: blockNumber, expectedBlockHash: pinnedBlock.blockHash },
        ),
        client.readContract({
          abi: emissionControllerAbi,
          address: runtime.addresses.emissionController,
          blockNumber,
          functionName: 'currentScheduledEmission',
        }),
        client.readContract({
          abi: emissionControllerAbi,
          address: runtime.addresses.emissionController,
          blockNumber,
          functionName: 'remainingMintCapacity',
        }),
        client.getBlock({ blockNumber }),
      ]);
      if (view.currentEpochId !== epochId || view.epochId !== epochId || view.blockNumber !== blockNumber) {
        throw new Error('Pinned mining epoch view did not match the requested current epoch.');
      }
      await revalidateBlockSnapshot(client, pinnedBlock);
      return {
        beneficiaryContribution: view.beneficiaryContribution,
        blockNumber,
        blockTimestamp: block.timestamp,
        contributionsPaused: view.contributionsPaused,
        currentScheduledEmission,
        endTime: view.epoch.endTime,
        epochId,
        extensionUsed: view.epoch.extensionUsed,
        invalidated: view.epoch.invalidated,
        referenceMiningPrice: view.referenceMiningPriceWad,
        remainingMintCapacity,
        startTime: view.epoch.startTime,
        totalContributed: view.epoch.totalContributed,
        usdGDecimals: view.usdGDecimals,
      };
    },
    refetchInterval: 15_000,
    staleTime: 12_000,
  });
}

/**
 * Reads the public bootstrap lifecycle and the connected beneficiary's position from one hash-bound block.
 * Live mode deliberately has no deterministic fallback: a missing or reorged RPC snapshot leaves genesis actions off.
 */
export function useGenesisBootstrapView() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const client = usePublicClient();
  const enabled = runtime.mode === 'live' && runtime.addresses !== null && client !== undefined;
  return useQuery({
    enabled,
    queryKey: [
      'genesis-bootstrap-view',
      runtime.chain.id,
      runtime.manifest?.gitCommit,
      runtime.addresses?.genesisBootstrap,
      runtime.addresses?.genesisClaims,
      account.address ?? ZERO_ADDRESS,
    ],
    queryFn: async (): Promise<GenesisBootstrapSnapshot> => {
      if (runtime.mode !== 'live' || runtime.addresses === null || client === undefined) {
        throw new Error('Validated genesis contracts and RPC client are required.');
      }
      const snapshot = await pinBlockSnapshot(client);
      const [view, block] = await Promise.all([
        readGenesisView(
          client,
          {
            genesisBootstrap: runtime.addresses.genesisBootstrap,
            genesisClaims: runtime.addresses.genesisClaims,
          },
          account.address ?? ZERO_ADDRESS,
          { atBlock: snapshot.blockNumber, expectedBlockHash: snapshot.blockHash },
        ),
        client.getBlock({ blockNumber: snapshot.blockNumber }),
      ]);
      if (view.blockNumber !== snapshot.blockNumber) {
        throw new Error('Genesis view did not match its requested pinned block.');
      }
      await revalidateBlockSnapshot(client, snapshot);
      return { ...view, blockTimestamp: block.timestamp };
    },
    refetchInterval: 15_000,
    refetchOnMount: 'always',
    retry: false,
    staleTime: 12_000,
  });
}

async function readLiveMiningClaims(
  client: PublicClient,
  miningPool: Address,
  miningClaims: Address,
  beneficiary: Address,
  deploymentBlock: bigint,
  cache?: {
    readonly anchorBlockHash: Hash;
    readonly anchorBlockNumber: bigint;
    readonly checkpoint: ContributionEpochScanCheckpoint;
  },
): Promise<{
  readonly anchorBlockHash: Hash;
  readonly anchorBlockNumber: bigint;
  readonly checkpoint: ContributionEpochScanCheckpoint;
  readonly data: LiveMiningClaimsResult;
}> {
  const targetBlock = await client.getBlock({ blockTag: 'latest' });
  const blockNumber = targetBlock.number;
  if (targetBlock.hash === null) throw new Error('Pinned claim-scan head did not have a block hash.');
  if (deploymentBlock > blockNumber) {
    throw new Error('MiningPool deployment block is newer than the pinned RPC head.');
  }
  let usableCheckpoint: ContributionEpochScanCheckpoint | undefined;
  if (cache !== undefined && cache.anchorBlockNumber <= blockNumber) {
    const currentAnchor = await client.getBlock({ blockNumber: cache.anchorBlockNumber });
    if (
      canResumeContributionEpochScan(cache.anchorBlockNumber, cache.anchorBlockHash, blockNumber, currentAnchor.hash)
    ) {
      usableCheckpoint = cache.checkpoint;
    }
  }
  const scan = await scanContributionEpochWindows(
    { checkpoint: usableCheckpoint, deploymentBlock, targetBlock: blockNumber },
    async (fromBlock, toBlock) => {
      const events = await client.getContractEvents({
        abi: miningPoolAbi,
        address: miningPool,
        eventName: 'MiningPool__Contribution',
        args: { beneficiary },
        fromBlock,
        toBlock,
      });
      return events.flatMap((event) => (event.args.epochId === undefined ? [] : [event.args.epochId]));
    },
  );
  const confirmedTargetBlock = await client.getBlock({ blockNumber });
  if (confirmedTargetBlock.hash !== targetBlock.hash) {
    throw new Error('Chain head changed while mining contribution history was being scanned.');
  }
  const nextCheckpoint = { epochIds: scan.epochIds, nextFromBlock: scan.nextFromBlock };
  if (!scan.complete) {
    return {
      anchorBlockHash: targetBlock.hash,
      anchorBlockNumber: blockNumber,
      checkpoint: nextCheckpoint,
      data: {
        rows: [],
        scanComplete: false,
        scannedThroughBlock: scan.scannedThroughBlock,
        targetBlock: blockNumber,
      },
    };
  }
  const epochIds = [...scan.epochIds].sort((left, right) => (left === right ? 0 : left > right ? -1 : 1));

  const rows = await mapWithConcurrency(epochIds, MAX_CLAIM_READ_CONCURRENCY, async (epochId) => {
    const [epoch, contributed, claimable, hasClaimed, expired] = await Promise.all([
      client.readContract({
        abi: miningPoolAbi,
        address: miningPool,
        args: [epochId],
        blockNumber,
        functionName: 'getEpoch',
      }),
      client.readContract({
        abi: miningPoolAbi,
        address: miningPool,
        args: [epochId, beneficiary],
        blockNumber,
        functionName: 'contributionOf',
      }),
      client.readContract({
        abi: miningClaimsAbi,
        address: miningClaims,
        args: [beneficiary, epochId],
        blockNumber,
        functionName: 'previewClaim',
      }),
      client.readContract({
        abi: miningClaimsAbi,
        address: miningClaims,
        args: [epochId, beneficiary],
        blockNumber,
        functionName: 'hasClaimed',
      }),
      client.readContract({
        abi: miningClaimsAbi,
        address: miningClaims,
        args: [epochId],
        blockNumber,
        functionName: 'distributionExpired',
      }),
    ]);
    return {
      claimable,
      contributed,
      epochId,
      expired,
      hasClaimed,
      invalidated: epoch.invalidated,
      settled: epoch.settled,
      settledAt: epoch.settledAt,
    };
  });
  const finalTargetBlock = await client.getBlock({ blockNumber });
  if (finalTargetBlock.hash !== targetBlock.hash) {
    throw new Error('Chain head changed while mining claims were being revalidated.');
  }
  return {
    anchorBlockHash: targetBlock.hash,
    anchorBlockNumber: blockNumber,
    checkpoint: nextCheckpoint,
    data: {
      rows: rows.filter((row) => row.contributed > 0n),
      scanComplete: true,
      scannedThroughBlock: scan.scannedThroughBlock,
      targetBlock: blockNumber,
    },
  };
}

export function useLiveMiningClaims() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const client = usePublicClient();
  const scanCache = useRef<{
    readonly anchorBlockHash: Hash;
    readonly anchorBlockNumber: bigint;
    readonly checkpoint: ContributionEpochScanCheckpoint;
    readonly key: string;
  } | null>(null);
  const enabled =
    runtime.mode === 'live' && runtime.addresses !== null && account.address !== undefined && client !== undefined;
  const scanKey = [
    runtime.chain.id.toString(),
    runtime.manifest?.gitCommit ?? 'no-manifest',
    runtime.addresses?.miningPool ?? ZERO_ADDRESS,
    runtime.addresses?.miningClaims ?? ZERO_ADDRESS,
    account.address ?? ZERO_ADDRESS,
    runtime.manifest?.miningPoolDeploymentBlock ?? '0',
  ].join(':');
  return useQuery({
    enabled,
    queryKey: [
      'live-mining-claims',
      runtime.chain.id,
      runtime.manifest?.gitCommit,
      runtime.addresses?.miningPool,
      runtime.addresses?.miningClaims,
      runtime.manifest?.miningPoolDeploymentBlock,
      account.address,
    ],
    queryFn: async (): Promise<LiveMiningClaimsResult> => {
      if (
        runtime.mode !== 'live' ||
        runtime.addresses === null ||
        account.address === undefined ||
        client === undefined
      ) {
        throw new Error('Validated mining contracts, beneficiary, and RPC client are required.');
      }
      const result = await readLiveMiningClaims(
        client,
        runtime.addresses.miningPool,
        runtime.addresses.miningClaims,
        account.address,
        BigInt(runtime.manifest.miningPoolDeploymentBlock),
        scanCache.current?.key === scanKey ? scanCache.current : undefined,
      );
      scanCache.current = {
        anchorBlockHash: result.anchorBlockHash,
        anchorBlockNumber: result.anchorBlockNumber,
        checkpoint: result.checkpoint,
        key: scanKey,
      };
      return result.data;
    },
    refetchInterval: (query) => (query.state.data?.scanComplete === false ? 250 : false),
    retry: false,
    staleTime: 12_000,
  });
}

export function useProtocolSnapshot() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const live = runtime.mode === 'live';
  const gbx = runtime.addresses?.gbx ?? ZERO_ADDRESS;
  const miningPool = runtime.addresses?.miningPool ?? ZERO_ADDRESS;
  const stakedGBX = runtime.addresses?.stakedGBX ?? ZERO_ADDRESS;
  const liveReadQuery = { enabled: live, refetchInterval: 15_000, staleTime: 12_000 } as const;

  const totalSupply = useReadContract({
    abi: gbxAbi,
    address: gbx,
    functionName: 'totalSupply',
    query: liveReadQuery,
  });
  const cumulativeMinted = useReadContract({
    abi: gbxAbi,
    address: gbx,
    functionName: 'cumulativeMinted',
    query: liveReadQuery,
  });
  const cumulativeBurned = useReadContract({
    abi: gbxAbi,
    address: gbx,
    functionName: 'cumulativeBurned',
    query: liveReadQuery,
  });
  const currentEpochId = useReadContract({
    abi: miningPoolAbi,
    address: miningPool,
    functionName: 'currentEpochId',
    query: liveReadQuery,
  });
  const referenceMiningPrice = useReadContract({
    abi: miningPoolAbi,
    address: miningPool,
    functionName: 'referenceMiningPrice',
    query: liveReadQuery,
  });
  const contributionsPaused = useReadContract({
    abi: miningPoolAbi,
    address: miningPool,
    functionName: 'contributionsPaused',
    query: liveReadQuery,
  });
  const stakedBalance = useReadContract({
    abi: stakedGbxAbi,
    address: stakedGBX,
    functionName: 'balanceOf',
    args: [account.address ?? ZERO_ADDRESS],
    query: {
      enabled: live && account.address !== undefined,
      refetchInterval: 15_000,
      staleTime: 12_000,
    },
  });

  const coreReads = [totalSupply, cumulativeMinted, cumulativeBurned, currentEpochId, referenceMiningPrice];
  const pending = live && coreReads.some((read) => read.isPending && read.data === undefined);
  const failed = live && coreReads.some((read) => read.isError);
  const complete = coreReads.every((read) => read.data !== undefined);
  const lastUpdatedAt = Math.max(0, ...coreReads.map((read) => read.dataUpdatedAt));
  const source: ProtocolReadSource = !live
    ? 'demo'
    : pending
      ? 'live-loading'
      : failed && complete
        ? 'live-stale'
        : failed || !complete
          ? 'rpc-fallback'
          : 'live';

  return {
    source,
    data: {
      totalSupply: totalSupply.data ?? (live ? 0n : protocolSnapshot.totalSupply),
      cumulativeMinted: cumulativeMinted.data ?? (live ? 0n : protocolSnapshot.cumulativeMinted),
      cumulativeBurned: cumulativeBurned.data ?? (live ? 0n : protocolSnapshot.cumulativeBurned),
      currentEpochId: currentEpochId.data ?? (live ? 0n : BigInt(miningEpoch.id)),
      referenceMiningPrice: referenceMiningPrice.data ?? (live ? 0n : miningEpoch.referenceMiningPrice),
      contributionsPaused: contributionsPaused.data ?? false,
      stakedBalance: stakedBalance.data ?? (live ? 0n : userSignalAccount.stakedGBX),
    },
    isRefreshing: live && coreReads.some((read) => read.isFetching),
    lastUpdatedAt: lastUpdatedAt === 0 ? null : lastUpdatedAt,
    fallbackFieldCount: coreReads.filter((read) => read.data === undefined).length,
    refetch: async () => {
      await Promise.all(coreReads.map((read) => read.refetch()));
    },
  };
}

export function useAllowance(token: Address | undefined, spender: Address | undefined, amount: bigint) {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const enabled =
    runtime.mode === 'live' && token !== undefined && spender !== undefined && account.address !== undefined;
  const read = useReadContract({
    abi: erc20TransactionAbi,
    address: token ?? ZERO_ADDRESS,
    functionName: 'allowance',
    args: [account.address ?? ZERO_ADDRESS, spender ?? ZERO_ADDRESS],
    query: { enabled },
  });
  return {
    ...read,
    allowance: read.data ?? 0n,
    needsApproval: enabled && (read.data ?? 0n) < amount,
  };
}

export interface RedemptionOutput {
  token: string;
  symbol: string;
  amount: bigint;
  decimals: number;
  isStockToken: boolean;
}

export function useRedemptionPreview(shares: bigint) {
  const runtime = useRuntimeDeployment();
  const client = usePublicClient();
  const enabled = runtime.mode === 'live' && shares > 0n && client !== undefined;
  const read = useQuery({
    enabled,
    queryKey: [
      'redemption-financial-preflight',
      runtime.chain.id,
      runtime.manifest?.gitCommit,
      runtime.addresses?.gumBallLens,
      shares.toString(),
    ],
    queryFn: async (): Promise<PinnedRedemptionPreflight> => {
      if (runtime.mode !== 'live' || client === undefined) {
        throw new Error('A validated runtime and RPC client are required for redemption preflight.');
      }
      return readPinnedRedemptionPreflight(client, runtime, shares);
    },
    refetchInterval: 15_000,
    retry: false,
    staleTime: 12_000,
  });

  const demo = previewRedemption(
    shares > protocolSnapshot.totalSupply ? protocolSnapshot.totalSupply : shares,
    protocolSnapshot.totalSupply,
    vaultAssets.map((asset) => ({ asset: asset.symbol, balance: asset.rawBalance })),
  ).map(({ asset, amount }) => {
    const fixture = vaultAssets.find(({ symbol }) => symbol === asset);
    return {
      token: asset,
      symbol: asset,
      amount,
      decimals: 18,
      isStockToken: ['QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL'].includes(fixture?.symbol ?? ''),
    };
  });

  if (runtime.mode === 'demo') {
    return {
      outputs: demo,
      source: 'demo' as const,
      isPending: read.isPending,
      blockHash: null,
      blockNumber: null,
      lastUpdatedAt: null,
      totalSupply: protocolSnapshot.totalSupply,
      refetch: async () => {
        throw new Error('Live redemption preflight is unavailable in demo mode.');
      },
    };
  }
  if (read.data === undefined || read.isError) {
    return {
      outputs: [] as readonly RedemptionOutput[],
      source: read.isError ? ('rpc-fallback' as const) : ('live-loading' as const),
      isPending: read.isPending,
      blockHash: null,
      blockNumber: null,
      lastUpdatedAt: null,
      totalSupply: 0n,
      refetch: async (): Promise<PinnedRedemptionPreflight> => {
        const result = await read.refetch();
        if (result.error !== null) throw result.error;
        if (result.data === undefined) throw new Error('Redemption preflight returned no data.');
        return result.data;
      },
    };
  }

  return {
    outputs: read.data.outputs,
    source: 'live' as const,
    isPending: false,
    blockHash: read.data.blockHash,
    blockNumber: read.data.blockNumber,
    lastUpdatedAt: read.dataUpdatedAt,
    totalSupply: read.data.totalSupply,
    refetch: async (): Promise<PinnedRedemptionPreflight> => {
      const result = await read.refetch();
      if (result.error !== null) throw result.error;
      if (result.data === undefined) throw new Error('Redemption preflight returned no data.');
      return result.data;
    },
  };
}

export function useAuctionRead(selection: AuctionPreflightSelection | undefined, usdGAmountRaw: bigint = 1n) {
  const runtime = useRuntimeDeployment();
  const client = usePublicClient();
  const enabled = runtime.mode === 'live' && client !== undefined && selection !== undefined && usdGAmountRaw > 0n;
  const read = useQuery({
    enabled,
    queryKey: [
      'auction-financial-preflight',
      runtime.chain.id,
      runtime.manifest?.gitCommit,
      selection?.strategy,
      selection?.kind,
      usdGAmountRaw.toString(),
    ],
    queryFn: async (): Promise<PinnedAuctionPreflight> => {
      if (runtime.mode !== 'live' || client === undefined || selection === undefined) {
        throw new Error('A validated strategy and RPC client are required for auction preflight.');
      }
      return readPinnedAuctionPreflight(client, runtime, selection, usdGAmountRaw);
    },
    refetchInterval: 15_000,
    retry: false,
    staleTime: 12_000,
  });
  const source =
    runtime.mode === 'demo'
      ? ('demo' as const)
      : !enabled
        ? ('rpc-fallback' as const)
        : read.isPending
          ? ('live-loading' as const)
          : read.isError || read.data === undefined
            ? ('rpc-fallback' as const)
            : ('live' as const);
  return {
    auctionId: source === 'demo' ? 184n : source === 'live' ? read.data!.auctionId : null,
    currentRate: source === 'demo' ? 1_000_000_000_000_000_000n : source === 'live' ? read.data!.currentRateWad : null,
    quote: source === 'live' ? read.data! : null,
    blockHash: source === 'live' ? read.data!.blockHash : null,
    blockNumber: source === 'live' ? read.data!.blockNumber : null,
    lastUpdatedAt: source === 'live' ? read.dataUpdatedAt : null,
    source,
    isPending: enabled && read.isPending,
    refetch: async (): Promise<PinnedAuctionPreflight> => {
      const result = await read.refetch();
      if (result.error !== null) throw result.error;
      if (result.data === undefined) throw new Error('Auction preflight returned no data.');
      return result.data;
    },
  };
}
