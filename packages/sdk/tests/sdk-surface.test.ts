import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionResult,
  type Log,
  type PublicClient,
} from 'viem';
import { describe, expect, it, vi } from 'vitest';

import {
  GENESIS_MINER_ALLOCATION,
  GBX_TOKEN_NAME,
  WAD,
  buildEip2612PermitTransaction,
  buildEip2612PermitTypedData,
  buildLiquidityMigration,
  buildRouterRedemptionWithPermit,
  buildRouterStakeWithPermit,
  closestV4TickForRawPrice,
  decodeMultiAssetRedemptionResult,
  decodeRedemptionReceipt,
  effectiveStockTokenMultiplierWad,
  gumBallVaultAbi,
  gumBallRouterAbi,
  liquidityManagerAbi,
  genesisSqrtPriceX96,
  nearestCanonicalUsableTick,
  normalizeSignalWeights,
  parseStockTokenMultiplierWad,
  protocolAddressesSchema,
  protocolDeploymentSchema,
  readGenesisView,
  readManagerRewardView,
  readMiningEpochView,
  readPendingActivationView,
  readRedemptionPreview,
  readCanonicalV4ExactInputQuote,
  readSupplyView,
  readStrategyAuctionQuote,
  resolveAssetRegistry,
  selectProtocolDeployment,
  sqrtPriceX96AtTick,
  sqrtPriceX96FromRawAmounts,
  tickAtSqrtPriceX96,
  v4QuoterAbi,
} from '../src/index.js';

const A = '0x0000000000000000000000000000000000000001';
const B = '0x0000000000000000000000000000000000000002';
const C = '0x0000000000000000000000000000000000000003';
const D = '0x0000000000000000000000000000000000000004';
const BLOCK_HASH = `0x${'ab'.repeat(32)}` as const;
const REORG_HASH = `0x${'cd'.repeat(32)}` as const;

function stableGetBlock(latestBlockNumber: bigint) {
  return async ({ blockNumber }: { blockNumber?: bigint } = {}) => ({
    hash: BLOCK_HASH,
    number: blockNumber ?? latestBlockNumber,
    timestamp: 1_000n,
  });
}

describe('generated ABI-backed maintenance builders', () => {
  it('encodes the reviewed LiquidityManager migration tuple without router commands', () => {
    const transaction = buildLiquidityMigration(A, {
      deadline: 1_000n,
      destinationPoolKey: { currency0: B, currency1: C, fee: 3_000, tickSpacing: 60, hooks: D },
      removals: [{ positionId: 7n, amount0Min: 10n, amount1Min: 20n }],
      replacements: [{ tickLower: -120, tickUpper: 120, liquidity: 30n, amount0Max: 40n, amount1Max: 50n }],
    });
    const decoded = decodeFunctionData({ abi: liquidityManagerAbi, data: transaction.data });
    expect(decoded.functionName).toBe('migrateLiquidity');
    expect(transaction.data.slice(0, 10)).toBe('0x4e4464a2');
    const decodedPlan = decoded.args?.[0] as {
      removals: readonly { positionId: bigint }[];
      replacements: readonly { tickLower: number }[];
    };
    expect(decodedPlan.removals[0]?.positionId).toBe(7n);
    expect(decodedPlan.replacements[0]?.tickLower).toBe(-120);
  });

  it('rejects unsorted migration currencies and out-of-range uint128 limits', () => {
    const plan = {
      deadline: 1n,
      destinationPoolKey: { currency0: C, currency1: B, fee: 3_000, tickSpacing: 60, hooks: D },
      removals: [{ positionId: 1n, amount0Min: 0n, amount1Min: 0n }],
      replacements: [{ tickLower: -60, tickUpper: 60, liquidity: 1n, amount0Max: 0n, amount1Max: 0n }],
    } as const;
    expect(() => buildLiquidityMigration(A, plan)).toThrow('address-sorted');
    expect(() =>
      buildLiquidityMigration(A, {
        ...plan,
        destinationPoolKey: { ...plan.destinationPoolKey, currency0: B, currency1: C },
        removals: [{ ...plan.removals[0], amount0Min: 1n << 128n }],
      }),
    ).toThrow('uint128');
  });
});

describe('EIP-2612 builders', () => {
  const permit = {
    chainId: 4663,
    deadline: 1_000n,
    name: GBX_TOKEN_NAME,
    nonce: 4n,
    owner: A,
    spender: B,
    token: C,
    value: 50n,
    version: '1',
  } as const;

  it('returns exact typed data and encodes the resulting permit signature', () => {
    const typedData = buildEip2612PermitTypedData(permit);
    expect(typedData.domain.name).toBe('GUM BALL 6900');
    expect(typedData.message.nonce).toBe(4n);
    const signature = `0x${'11'.repeat(32)}${'22'.repeat(32)}1b` as const;
    const transaction = buildEip2612PermitTransaction(permit, signature);
    expect(transaction.to).toBe(C);
  });

  it('rejects malformed signatures and unsafe chain IDs', () => {
    expect(() => buildEip2612PermitTransaction(permit, '0x12')).toThrow('65-byte');
    expect(() => buildEip2612PermitTypedData({ ...permit, chainId: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
  });

  it('encodes the canonical bounded router permit flows', () => {
    const signature = `0x${'11'.repeat(32)}${'22'.repeat(32)}1b` as const;
    const stake = decodeFunctionData({
      abi: gumBallRouterAbi,
      data: buildRouterStakeWithPermit(D, 50n, 1_000n, signature).data,
    });
    expect(stake.functionName).toBe('stakeWithPermit');
    const redemption = decodeFunctionData({
      abi: gumBallRouterAbi,
      data: buildRouterRedemptionWithPermit(D, 25n, C, 1_000n, signature).data,
    });
    expect(redemption.functionName).toBe('redeemWithPermit');
  });
});

describe('signal normalization and stock-token multipliers', () => {
  it('matches onchain floor allocation and assigns residual dust to the final strategy', () => {
    expect(
      normalizeSignalWeights(10n, [
        { strategy: A, relativeWeight: 1n },
        { strategy: B, relativeWeight: 1n },
        { strategy: C, relativeWeight: 1n },
      ]).map(({ activeAndPendingWeight }) => activeAndPendingWeight),
    ).toEqual([3n, 3n, 4n]);
  });

  it('parses and activates multipliers without floating point', () => {
    expect(parseStockTokenMultiplierWad('1.2345')).toBe(1_234_500_000_000_000_000n);
    const state = { currentMultiplierWad: WAD, pendingMultiplierWad: 2n * WAD, pendingEffectiveAt: 100n };
    expect(effectiveStockTokenMultiplierWad(state, 99n)).toBe(WAD);
    expect(effectiveStockTokenMultiplierWad(state, 100n)).toBe(2n * WAD);
    expect(() => parseStockTokenMultiplierWad('1.0000000000000000001')).toThrow();
  });
});

describe('official Uniswap SDK price helpers', () => {
  it('round-trips the canonical 1:1 sqrt price and ticks', () => {
    const q96 = 1n << 96n;
    expect(sqrtPriceX96FromRawAmounts(1n, 1n)).toBe(q96);
    expect(sqrtPriceX96AtTick(0)).toBe(q96);
    expect(tickAtSqrtPriceX96(q96)).toBe(0);
    expect(nearestCanonicalUsableTick(119)).toBe(120);
  });

  it('encodes genesis ratios in both token orders, including the old uint256-overflow domain', () => {
    const q96 = 1n << 96n;
    expect(genesisSqrtPriceX96(A, B, GENESIS_MINER_ALLOCATION)).toBe(q96);
    expect(genesisSqrtPriceX96(B, A, GENESIS_MINER_ALLOCATION)).toBe(q96);
    expect(genesisSqrtPriceX96(B, A, 1n)).toBe(708_638_228_457_182_841_184_406_864_642_904_026_128_471n);
  });

  it('uses explicit token decimals in price-to-tick conversion', () => {
    const base = { address: A, chainId: 4663, decimals: 18, symbol: 'GBX' } as const;
    const quote = { address: B, chainId: 4663, decimals: 18, symbol: 'USDG' } as const;
    expect(closestV4TickForRawPrice(base, quote, WAD, WAD)).toBe(0);
  });

  it('reads a block-pinned exact-input quote without building router calldata', async () => {
    const client = {
      getBlock: stableGetBlock(1_234n),
      call: async () => ({
        data: encodeFunctionResult({
          abi: v4QuoterAbi,
          functionName: 'quoteExactInputSingle',
          result: [95n, 123_000n],
        }),
      }),
    } as unknown as PublicClient;
    const quote = await readCanonicalV4ExactInputQuote(client, {
      exactAmountRaw: 100n,
      inputCurrency: A,
      inputDecimals: 18,
      outputDecimals: 6,
      poolKey: { currency0: A, currency1: B, fee: 3_000, tickSpacing: 60, hooks: C },
      quoter: D,
      expectedBlockHash: BLOCK_HASH,
    });
    expect(quote).toMatchObject({ amountOutRaw: 95n, blockNumber: 1_234n, outputCurrency: B, zeroForOne: true });
  });

  it('rejects an exact-input quote when the pinned block hash changes', async () => {
    const getBlock = vi
      .fn()
      .mockResolvedValueOnce({ hash: BLOCK_HASH, number: 1_234n })
      .mockResolvedValueOnce({ hash: REORG_HASH, number: 1_234n });
    const client = {
      getBlock,
      call: async () => ({
        data: encodeFunctionResult({
          abi: v4QuoterAbi,
          functionName: 'quoteExactInputSingle',
          result: [95n, 123_000n],
        }),
      }),
    } as unknown as PublicClient;
    await expect(
      readCanonicalV4ExactInputQuote(client, {
        exactAmountRaw: 100n,
        inputCurrency: A,
        inputDecimals: 18,
        outputDecimals: 6,
        poolKey: { currency0: A, currency1: B, fee: 3_000, tickSpacing: 60, hooks: C },
        quoter: D,
      }),
    ).rejects.toThrow('Chain state changed');
  });
});

describe('multi-asset redemption decoding', () => {
  it('binds return amounts to explicit token decimals', () => {
    const data = encodeFunctionResult({ abi: gumBallVaultAbi, functionName: 'redeem', result: [10n, 20n] });
    expect(
      decodeMultiAssetRedemptionResult(data, [
        { token: B, decimals: 6, symbol: 'USDG' },
        { token: C, decimals: 18, symbol: 'NVDA' },
      ]),
    ).toEqual([
      { token: B, decimals: 6, symbol: 'USDG', amountRaw: 10n },
      { token: C, decimals: 18, symbol: 'NVDA', amountRaw: 20n },
    ]);
    expect(() => decodeMultiAssetRedemptionResult(data, [{ token: B, decimals: 6 }])).toThrow('2 amounts');
  });

  it('decodes receipt events and rejects ambiguous summaries', () => {
    const assetLog = {
      address: A,
      data: encodeAbiParameters([{ type: 'uint256' }], [10n]),
      topics: encodeEventTopics({
        abi: gumBallVaultAbi,
        eventName: 'GumBallVault__AssetRedeemed',
        args: { receiver: C, asset: B },
      }),
    } as unknown as Log;
    const summaryLog = {
      address: A,
      data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [5n, 100n]),
      topics: encodeEventTopics({
        abi: gumBallVaultAbi,
        eventName: 'GumBallVault__Redeemed',
        args: { owner: D, receiver: C },
      }),
    } as unknown as Log;
    expect(decodeRedemptionReceipt([assetLog, summaryLog], A)).toEqual({
      amounts: [{ token: B, amountRaw: 10n }],
      owner: D,
      receiver: C,
      shares: 5n,
      supplyBefore: 100n,
    });
    expect(() => decodeRedemptionReceipt([summaryLog, summaryLog], A)).toThrow('exactly one');
  });
});

describe('runtime-validated reads', () => {
  it('derives pending signal maturity from an explicit timestamp', async () => {
    const client = {
      getBlock: stableGetBlock(900n),
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName !== 'userSignalViews') throw new Error('unexpected read');
        return [100n, 500n, false, [{ strategy: B, activeWeight: 60n, pendingIncrease: 40n }]];
      },
    } as unknown as PublicClient;
    const view = await readPendingActivationView(client, A, C, 500n);
    expect(view.blockNumber).toBe(900n);
    expect(view.isMature).toBe(true);
    expect(view.signals[0]?.pendingIncrease).toBe(40n);
  });

  it('quotes an auction from live strategy, registry, and preview-budget reads', async () => {
    const values: Record<string, unknown> = {
      ALLOCATION_VOTER: B,
      ASSET_REGISTRY: C,
      AUCTION_DURATION: 86_400n,
      MAXIMUM_LOT_USDG: 1_000_000_000n,
      MINIMUM_LOT_USDG: 10_000_000n,
      TARGET_DECIMALS: 18,
      USDG_DECIMALS: 6,
      auctionId: 7n,
      auctionStartTime: 100n,
      currentRate: WAD / 2n,
      fillsPaused: false,
      floorRate: WAD / 4n,
      isLiveStrategy: true,
      previewStrategyBudget: 800_000_000n,
      referenceRate: WAD / 2n,
      startRate: WAD,
    };
    const client = {
      getBlock: stableGetBlock(901n),
      readContract: async ({ functionName }: { functionName: string }) => values[functionName],
    } as unknown as PublicClient;
    const quote = await readStrategyAuctionQuote(client, {
      kind: 'acquisition',
      strategy: A,
      usdGAmountRaw: 100_000_000n,
    });
    expect(quote.requiredTargetRaw).toBe(50n * WAD);
    expect(quote.availableBudgetRaw).toBe(800_000_000n);
    expect(quote).toMatchObject({ auctionExpiresAt: 86_500n, blockTimestamp: 1_000n, isExpired: false });
  });

  it('fails closed when an auction pin omits time or reports a future start', async () => {
    const values: Record<string, unknown> = {
      ALLOCATION_VOTER: B,
      ASSET_REGISTRY: C,
      AUCTION_DURATION: 86_400n,
      MAXIMUM_LOT_USDG: 1_000_000_000n,
      MINIMUM_LOT_USDG: 10_000_000n,
      TARGET_DECIMALS: 18,
      USDG_DECIMALS: 6,
      auctionId: 7n,
      auctionStartTime: 100n,
      currentRate: WAD / 2n,
      fillsPaused: false,
      floorRate: WAD / 4n,
      isLiveStrategy: true,
      previewStrategyBudget: 800_000_000n,
      referenceRate: WAD / 2n,
      startRate: WAD,
    };
    const withoutTimestamp = {
      getBlock: async ({ blockNumber }: { blockNumber?: bigint } = {}) => ({
        hash: BLOCK_HASH,
        number: blockNumber ?? 901n,
      }),
      readContract: async ({ functionName }: { functionName: string }) => values[functionName],
    } as unknown as PublicClient;
    await expect(
      readStrategyAuctionQuote(withoutTimestamp, {
        kind: 'acquisition',
        strategy: A,
        usdGAmountRaw: 100_000_000n,
      }),
    ).rejects.toThrow('omitted the pinned auction block timestamp');

    const futureStart = {
      getBlock: stableGetBlock(901n),
      readContract: async ({ functionName }: { functionName: string }) =>
        functionName === 'auctionStartTime' ? 1_001n : values[functionName],
    } as unknown as PublicClient;
    await expect(
      readStrategyAuctionQuote(futureStart, {
        kind: 'acquisition',
        strategy: A,
        usdGAmountRaw: 100_000_000n,
      }),
    ).rejects.toThrow('later than the pinned block timestamp');
  });

  it('returns mining snapshots pinned to exactly one requested block', async () => {
    const blockNumbers: bigint[] = [];
    const values: Record<string, unknown> = {
      USDG_DECIMALS: 6,
      contributionOf: 50n,
      contributionsPaused: false,
      currentEpochId: 3n,
      getEpoch: {
        actualEmission: 80n,
        clearingPrice: WAD,
        endTime: 200n,
        extensionUsed: 0n,
        invalidated: false,
        minimumMiningPrice: WAD,
        scheduledEmission: 100n,
        settled: true,
        settledAt: 201n,
        startTime: 100n,
        totalContributed: 100n,
      },
      previewClaim: 40n,
      referenceMiningPrice: WAD,
    };
    const client = {
      getBlock: stableGetBlock(77n),
      readContract: async ({ blockNumber, functionName }: { blockNumber: bigint; functionName: string }) => {
        blockNumbers.push(blockNumber);
        return values[functionName];
      },
    } as unknown as PublicClient;
    const view = await readMiningEpochView(client, { miningPool: A, miningClaims: B }, 2n, C, { atBlock: 77n });
    expect(view.blockNumber).toBe(77n);
    expect(view.beneficiaryPreviewClaim).toBe(40n);
    expect(new Set(blockNumbers)).toEqual(new Set([77n]));
  });

  it('validates genesis and manager reward snapshots', async () => {
    const genesisValues: Record<string, unknown> = {
      USDG_DECIMALS: 6,
      bootstrapContributionCap: 1_000n,
      communityContribution: 10n,
      communityUSDG: 100n,
      contributionEnd: 20n,
      contributionStart: 10n,
      genesisPriceWad: WAD,
      minimumBootstrapUSDG: 50n,
      previewClaim: 8n,
      requiredSponsorUSDG: 25n,
      settledAt: 30n,
      settlementDeadline: 29n,
      sponsorEscrow: 25n,
      state: 4,
    };
    const genesisClient = {
      getBlock: stableGetBlock(11n),
      readContract: async ({ functionName }: { functionName: string }) => genesisValues[functionName],
    } as unknown as PublicClient;
    const genesis = await readGenesisView(genesisClient, { genesisBootstrap: A, genesisClaims: B }, C, {
      atBlock: 11n,
    });
    expect(genesis.state).toBe(4);
    expect(genesis.beneficiaryPreviewClaim).toBe(8n);

    const rewardValues: Record<string, unknown> = {
      REWARD_TOKEN: B,
      STRATEGY: C,
      accountedRewards: 10n,
      currentGeneration: 2n,
      currentRemainderCycle: 3n,
      decimals: 18,
      earned: 4n,
      rewardPerWeightStored: 5n,
      rewardReceiver: D,
      rewardRemainder: 1n,
      totalAccruedRewards: 4n,
      totalPendingTerminalDust: 1n,
    };
    const rewardsClient = {
      getBlock: stableGetBlock(12n),
      readContract: async ({ functionName }: { functionName: string }) => rewardValues[functionName],
    } as unknown as PublicClient;
    const rewardView = await readManagerRewardView(rewardsClient, A, C, { atBlock: 12n });
    expect(rewardView.earnedRaw).toBe(4n);
    expect(rewardView.currentGeneration).toBe(2n);
    expect(rewardView.currentRemainderCycle).toBe(3n);
    expect(rewardView.totalPendingTerminalDust).toBe(1n);
  });

  it('resolves bounded registry metadata and rejects token/config mismatches', async () => {
    const bytes32 = `0x${'11'.repeat(32)}` as const;
    const config = {
      acquisitionEnabled: true,
      assetId: bytes32,
      decimals: 18,
      isStockToken: true,
      redemptionEnabled: true,
      rewards: C,
      strategy: D,
      symbolHash: bytes32,
      token: B,
    };
    const client = {
      getBlock: stableGetBlock(9n),
      readContract: async ({ functionName }: { functionName: string }) =>
        ({ assetCount: 1n, assetAt: B, configFor: config })[functionName as 'assetCount'],
    } as unknown as PublicClient;
    expect((await resolveAssetRegistry(client, A, { atBlock: 9n }))[0]?.decimals).toBe(18);
    const mismatchClient = {
      getBlock: stableGetBlock(9n),
      readContract: async ({ functionName }: { functionName: string }) =>
        ({ assetCount: 1n, assetAt: B, configFor: { ...config, token: C } })[functionName as 'assetCount'],
    } as unknown as PublicClient;
    await expect(resolveAssetRegistry(mismatchClient, A, { atBlock: 9n })).rejects.toThrow('mismatch');
  });

  it('reads supply and multi-asset redemption previews from revalidated blocks', async () => {
    const supplyClient = {
      getBlock: stableGetBlock(13n),
      readContract: async () => ({
        cumulativeBurned: 10n,
        cumulativeMinted: 100n,
        remainingMintCapacity: 900n,
        totalSupply: 90n,
      }),
    } as unknown as PublicClient;
    await expect(readSupplyView(supplyClient, A, { atBlock: 13n })).resolves.toEqual({
      blockNumber: 13n,
      cumulativeBurned: 10n,
      cumulativeMinted: 100n,
      remainingMintCapacity: 900n,
      totalSupply: 90n,
    });

    const redemptionClient = {
      getBlock: stableGetBlock(14n),
      readContract: async () => [
        [B, C],
        [10n, 20n],
      ],
    } as unknown as PublicClient;
    await expect(readRedemptionPreview(redemptionClient, A, 5n, { atBlock: 14n })).resolves.toEqual({
      amountsOutRaw: [10n, 20n],
      blockNumber: 14n,
      shares: 5n,
      tokens: [B, C],
    });

    const mismatchClient = {
      getBlock: stableGetBlock(14n),
      readContract: async () => [[B, C], [10n]],
    } as unknown as PublicClient;
    await expect(readRedemptionPreview(mismatchClient, A, 5n, { atBlock: 14n })).rejects.toThrow('length mismatch');
  });

  it('rejects a composed reader when a reorg replaces its pinned block', async () => {
    const values: Record<string, unknown> = {
      USDG_DECIMALS: 6,
      contributionOf: 50n,
      contributionsPaused: false,
      currentEpochId: 3n,
      getEpoch: {
        actualEmission: 80n,
        clearingPrice: WAD,
        endTime: 200n,
        extensionUsed: 0n,
        invalidated: false,
        minimumMiningPrice: WAD,
        scheduledEmission: 100n,
        settled: true,
        settledAt: 201n,
        startTime: 100n,
        totalContributed: 100n,
      },
      previewClaim: 40n,
      referenceMiningPrice: WAD,
    };
    const client = {
      getBlock: vi
        .fn()
        .mockResolvedValueOnce({ hash: BLOCK_HASH, number: 77n })
        .mockResolvedValueOnce({ hash: REORG_HASH, number: 77n }),
      readContract: async ({ functionName }: { functionName: string }) => values[functionName],
    } as unknown as PublicClient;

    await expect(
      readMiningEpochView(client, { miningPool: A, miningClaims: B }, 2n, C, { atBlock: 77n }),
    ).rejects.toThrow('Chain state changed');
  });
});

describe('deployment runtime validation', () => {
  const addressEntries = [
    'gbx',
    'protocolTimelock',
    'strategyDeployer',
    'emergencyGuardian',
    'eligibilityModule',
    'genesisBootstrap',
    'genesisClaims',
    'emissionController',
    'miningPool',
    'miningClaims',
    'gumBallVault',
    'assetRegistry',
    'stakedGBX',
    'allocationVoter',
    'revenueRouter',
    'holdUSDGStrategy',
    'buybackBurnStrategy',
    'liquidityManager',
    'launchGuardHook',
    'genesisLiquidityCalculator',
    'gumBallLens',
    'gumBallRouter',
  ] as const;
  const addresses = Object.fromEntries(
    addressEntries.map((key, index) => [key, `0x${(index + 1).toString(16).padStart(40, '0')}`]),
  );

  it('rejects zero/duplicate contract maps and fail-closes deployment selection', () => {
    expect(protocolAddressesSchema.parse(addresses)).toBeDefined();
    expect(() => protocolAddressesSchema.parse({ ...addresses, gbx: addresses.genesisBootstrap })).toThrow();
    const deployment = protocolDeploymentSchema.parse({
      addresses,
      chainId: 4663,
      deploymentId: 'mainnet-v1',
      manifestPayloadHash: `0x${'11'.repeat(32)}`,
      releaseVersion: 'v1.0.0',
      status: 'mainnet-candidate',
    });
    expect(() => selectProtocolDeployment([deployment], 4663)).toThrow('exactly one');
    expect(selectProtocolDeployment([deployment], 4663, { requireReleaseApproved: false }).deploymentId).toBe(
      'mainnet-v1',
    );
  });
});
