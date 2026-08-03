import { encodeFunctionData, getAddress, type Address, type Hex } from 'viem';

import {
  acquisitionStrategyAbi,
  allocationVoterAbi,
  buybackStrategyAbi,
  genesisBootstrapAbi,
  genesisClaimsAbi,
  gbxAbi,
  gumBallVaultAbi,
  gumBallRouterAbi,
  liquidityManagerAbi,
  managerRewardsAbi,
  miningClaimsAbi,
  miningPoolAbi,
  stakedGbxAbi,
} from './abis.js';
import { decodeEip2612Signature } from './permit.js';
import { assertUint, positiveBigIntSchema, unsignedBigIntSchema } from './validation.js';

export interface ContractTransaction {
  to: Address;
  data: Hex;
  value: 0n;
}

function transaction(to: Address, data: Hex): ContractTransaction {
  return { to: getAddress(to), data, value: 0n };
}

function positiveAmount(amount: bigint, name: string): void {
  try {
    positiveBigIntSchema.parse(amount);
  } catch {
    throw new RangeError(`${name} must be positive`);
  }
  assertUint(amount, 256, name);
}

export function buildApproval(token: Address, spender: Address, amount: bigint): ContractTransaction {
  unsignedBigIntSchema.parse(amount);
  assertUint(amount, 256, 'amount');
  return transaction(
    token,
    encodeFunctionData({ abi: gbxAbi, functionName: 'approve', args: [getAddress(spender), amount] }),
  );
}

export function buildGenesisContribution(
  genesisBootstrap: Address,
  beneficiary: Address,
  requestedAmount: bigint,
): ContractTransaction {
  positiveAmount(requestedAmount, 'requestedAmount');
  return transaction(
    genesisBootstrap,
    encodeFunctionData({
      abi: genesisBootstrapAbi,
      functionName: 'contribute',
      args: [getAddress(beneficiary), requestedAmount],
    }),
  );
}

export function buildGenesisSponsorFunding(genesisBootstrap: Address, requestedAmount: bigint): ContractTransaction {
  positiveAmount(requestedAmount, 'requestedAmount');
  return transaction(
    genesisBootstrap,
    encodeFunctionData({ abi: genesisBootstrapAbi, functionName: 'fundSponsor', args: [requestedAmount] }),
  );
}

export function buildOpenGenesisContributions(genesisBootstrap: Address): ContractTransaction {
  return transaction(
    genesisBootstrap,
    encodeFunctionData({ abi: genesisBootstrapAbi, functionName: 'openContributions' }),
  );
}

export function buildCloseGenesisContributions(genesisBootstrap: Address): ContractTransaction {
  return transaction(genesisBootstrap, encodeFunctionData({ abi: genesisBootstrapAbi, functionName: 'close' }));
}

export function buildSettleGenesis(genesisBootstrap: Address, sqrtPriceX96: bigint): ContractTransaction {
  positiveBigIntSchema.parse(sqrtPriceX96);
  assertUint(sqrtPriceX96, 160, 'sqrtPriceX96');
  return transaction(
    genesisBootstrap,
    encodeFunctionData({ abi: genesisBootstrapAbi, functionName: 'settle', args: [sqrtPriceX96] }),
  );
}

export function buildGenesisRefund(genesisBootstrap: Address, beneficiary: Address): ContractTransaction {
  return transaction(
    genesisBootstrap,
    encodeFunctionData({ abi: genesisBootstrapAbi, functionName: 'refund', args: [getAddress(beneficiary)] }),
  );
}

export function buildGenesisClaim(genesisClaims: Address, beneficiary: Address): ContractTransaction {
  return transaction(
    genesisClaims,
    encodeFunctionData({ abi: genesisClaimsAbi, functionName: 'claim', args: [getAddress(beneficiary)] }),
  );
}

export function buildGenesisClaimBatch(genesisClaims: Address, beneficiaries: readonly Address[]): ContractTransaction {
  if (beneficiaries.length === 0 || beneficiaries.length > 64) {
    throw new RangeError('beneficiaries length must be between 1 and 64');
  }
  const normalizedBeneficiaries = beneficiaries.map((beneficiary) => getAddress(beneficiary));
  if (new Set(normalizedBeneficiaries).size !== normalizedBeneficiaries.length) {
    throw new RangeError('duplicate beneficiary');
  }
  return transaction(
    genesisClaims,
    encodeFunctionData({
      abi: genesisClaimsAbi,
      functionName: 'claimBatch',
      args: [normalizedBeneficiaries],
    }),
  );
}

export function buildMiningContribution(
  miningPool: Address,
  beneficiary: Address,
  requestedAmount: bigint,
): ContractTransaction {
  positiveAmount(requestedAmount, 'requestedAmount');
  return transaction(
    miningPool,
    encodeFunctionData({
      abi: miningPoolAbi,
      functionName: 'contribute',
      args: [getAddress(beneficiary), requestedAmount],
    }),
  );
}

export function buildMiningClaimBatch(
  miningClaims: Address,
  beneficiary: Address,
  epochIds: readonly bigint[],
): ContractTransaction {
  if (epochIds.length === 0 || epochIds.length > 64) throw new RangeError('epochIds length must be between 1 and 64');
  if (new Set(epochIds).size !== epochIds.length) throw new RangeError('duplicate epochId');
  epochIds.forEach((epochId) => {
    unsignedBigIntSchema.parse(epochId);
    assertUint(epochId, 256, 'epochId');
  });
  return transaction(
    miningClaims,
    encodeFunctionData({
      abi: miningClaimsAbi,
      functionName: 'claimBatch',
      args: [getAddress(beneficiary), [...epochIds]],
    }),
  );
}

export function buildMiningClaim(miningClaims: Address, beneficiary: Address, epochId: bigint): ContractTransaction {
  unsignedBigIntSchema.parse(epochId);
  assertUint(epochId, 256, 'epochId');
  return transaction(
    miningClaims,
    encodeFunctionData({ abi: miningClaimsAbi, functionName: 'claim', args: [getAddress(beneficiary), epochId] }),
  );
}

export function buildMiningRefund(miningPool: Address, beneficiary: Address, epochId: bigint): ContractTransaction {
  unsignedBigIntSchema.parse(epochId);
  assertUint(epochId, 256, 'epochId');
  return transaction(
    miningPool,
    encodeFunctionData({ abi: miningPoolAbi, functionName: 'refund', args: [getAddress(beneficiary), epochId] }),
  );
}

export function buildSettleCurrentMiningEpoch(miningPool: Address): ContractTransaction {
  return transaction(miningPool, encodeFunctionData({ abi: miningPoolAbi, functionName: 'settleCurrentEpoch' }));
}

export function buildStake(stakedGBX: Address, amount: bigint): ContractTransaction {
  positiveAmount(amount, 'amount');
  return transaction(stakedGBX, encodeFunctionData({ abi: stakedGbxAbi, functionName: 'stake', args: [amount] }));
}

export function buildRouterStake(gumBallRouter: Address, amount: bigint): ContractTransaction {
  positiveAmount(amount, 'amount');
  return transaction(
    gumBallRouter,
    encodeFunctionData({ abi: gumBallRouterAbi, functionName: 'stake', args: [amount] }),
  );
}

export function buildRouterStakeWithPermit(
  gumBallRouter: Address,
  amount: bigint,
  permitDeadline: bigint,
  signature: Hex,
): ContractTransaction {
  positiveAmount(amount, 'amount');
  positiveAmount(permitDeadline, 'permitDeadline');
  const { r, s, v } = decodeEip2612Signature(signature);
  return transaction(
    gumBallRouter,
    encodeFunctionData({
      abi: gumBallRouterAbi,
      functionName: 'stakeWithPermit',
      args: [amount, permitDeadline, v, r, s],
    }),
  );
}

export function buildUnstake(stakedGBX: Address, amount: bigint): ContractTransaction {
  positiveAmount(amount, 'amount');
  return transaction(stakedGBX, encodeFunctionData({ abi: stakedGbxAbi, functionName: 'unstake', args: [amount] }));
}

export function buildSignal(
  allocationVoter: Address,
  strategies: readonly Address[],
  relativeWeights: readonly bigint[],
): ContractTransaction {
  if (strategies.length === 0 || strategies.length > 16 || strategies.length !== relativeWeights.length) {
    throw new RangeError('strategies and relativeWeights must have matching lengths between 1 and 16');
  }
  const normalizedStrategies = strategies.map((strategy) => getAddress(strategy));
  if (new Set(normalizedStrategies).size !== normalizedStrategies.length) throw new RangeError('duplicate strategy');
  if (relativeWeights.some((weight) => weight <= 0n)) throw new RangeError('relative weights must be positive');
  relativeWeights.forEach((weight) => assertUint(weight, 256, 'relativeWeight'));
  assertUint(
    relativeWeights.reduce((sum, weight) => sum + weight, 0n),
    256,
    'totalRelativeWeight',
  );
  return transaction(
    allocationVoter,
    encodeFunctionData({
      abi: allocationVoterAbi,
      functionName: 'signal',
      args: [normalizedStrategies, [...relativeWeights]],
    }),
  );
}

export function buildResetSignals(allocationVoter: Address): ContractTransaction {
  return transaction(allocationVoter, encodeFunctionData({ abi: allocationVoterAbi, functionName: 'resetSignals' }));
}

export function buildCancelPendingSignals(allocationVoter: Address): ContractTransaction {
  return transaction(
    allocationVoter,
    encodeFunctionData({ abi: allocationVoterAbi, functionName: 'cancelPendingSignals' }),
  );
}

export function buildCheckpointUser(allocationVoter: Address, user: Address): ContractTransaction {
  return transaction(
    allocationVoter,
    encodeFunctionData({ abi: allocationVoterAbi, functionName: 'checkpointUser', args: [getAddress(user)] }),
  );
}

export function buildManagerRewardClaim(managerRewards: Address, user: Address): ContractTransaction {
  return transaction(
    managerRewards,
    encodeFunctionData({ abi: managerRewardsAbi, functionName: 'claim', args: [getAddress(user)] }),
  );
}

export function buildManagerRewardReceiver(managerRewards: Address, receiver: Address): ContractTransaction {
  return transaction(
    managerRewards,
    encodeFunctionData({ abi: managerRewardsAbi, functionName: 'setRewardReceiver', args: [getAddress(receiver)] }),
  );
}

export function buildManagerRewardTerminalDustSweep(
  managerRewards: Address,
  generation: bigint,
  remainderCycle: bigint,
): ContractTransaction {
  unsignedBigIntSchema.parse(generation);
  unsignedBigIntSchema.parse(remainderCycle);
  assertUint(generation, 64, 'generation');
  assertUint(remainderCycle, 64, 'remainderCycle');
  return transaction(
    managerRewards,
    encodeFunctionData({
      abi: managerRewardsAbi,
      functionName: 'sweepTerminalDust',
      args: [generation, remainderCycle],
    }),
  );
}

export function buildRedemption(vault: Address, shares: bigint, receiver: Address): ContractTransaction {
  positiveAmount(shares, 'shares');
  return transaction(
    vault,
    encodeFunctionData({
      abi: gumBallVaultAbi,
      functionName: 'redeem',
      args: [shares, getAddress(receiver)],
    }),
  );
}

export function buildRouterRedemption(gumBallRouter: Address, shares: bigint, receiver: Address): ContractTransaction {
  positiveAmount(shares, 'shares');
  return transaction(
    gumBallRouter,
    encodeFunctionData({
      abi: gumBallRouterAbi,
      functionName: 'redeem',
      args: [shares, getAddress(receiver)],
    }),
  );
}

export function buildRouterRedemptionWithPermit(
  gumBallRouter: Address,
  shares: bigint,
  receiver: Address,
  permitDeadline: bigint,
  signature: Hex,
): ContractTransaction {
  positiveAmount(shares, 'shares');
  positiveAmount(permitDeadline, 'permitDeadline');
  const { r, s, v } = decodeEip2612Signature(signature);
  return transaction(
    gumBallRouter,
    encodeFunctionData({
      abi: gumBallRouterAbi,
      functionName: 'redeemWithPermit',
      args: [shares, getAddress(receiver), permitDeadline, v, r, s],
    }),
  );
}

export interface AuctionFillParameters {
  readonly strategy: Address;
  readonly expectedAuctionId: bigint;
  readonly usdGAmountRaw: bigint;
  /** Raw acquisition target-token units, or raw GBX units for a buyback. */
  readonly maximumTargetAmountRaw: bigint;
  readonly usdGReceiver: Address;
  readonly deadline: bigint;
}

export function buildAcquisitionFill(parameters: AuctionFillParameters): ContractTransaction {
  validateAuctionFill(parameters);
  return transaction(
    parameters.strategy,
    encodeFunctionData({
      abi: acquisitionStrategyAbi,
      functionName: 'fill',
      args: [
        parameters.expectedAuctionId,
        parameters.usdGAmountRaw,
        parameters.maximumTargetAmountRaw,
        getAddress(parameters.usdGReceiver),
        parameters.deadline,
      ],
    }),
  );
}

export function buildBuybackFill(parameters: AuctionFillParameters): ContractTransaction {
  validateAuctionFill(parameters);
  return transaction(
    parameters.strategy,
    encodeFunctionData({
      abi: buybackStrategyAbi,
      functionName: 'fill',
      args: [
        parameters.expectedAuctionId,
        parameters.usdGAmountRaw,
        parameters.maximumTargetAmountRaw,
        getAddress(parameters.usdGReceiver),
        parameters.deadline,
      ],
    }),
  );
}

export function buildRestartAcquisitionAuction(strategy: Address): ContractTransaction {
  return transaction(
    strategy,
    encodeFunctionData({ abi: acquisitionStrategyAbi, functionName: 'restartExpiredAuction' }),
  );
}

export function buildRestartBuybackAuction(strategy: Address): ContractTransaction {
  return transaction(strategy, encodeFunctionData({ abi: buybackStrategyAbi, functionName: 'restartExpiredAuction' }));
}

function validateAuctionFill(parameters: AuctionFillParameters): void {
  assertUint(parameters.expectedAuctionId, 64, 'expectedAuctionId');
  positiveAmount(parameters.usdGAmountRaw, 'usdGAmountRaw');
  positiveAmount(parameters.maximumTargetAmountRaw, 'maximumTargetAmountRaw');
  positiveAmount(parameters.deadline, 'deadline');
}

export interface LiquidityMigrationRemoval {
  readonly positionId: bigint;
  readonly amount0Min: bigint;
  readonly amount1Min: bigint;
}

export interface LiquidityMigrationReplacement {
  readonly tickLower: number;
  readonly tickUpper: number;
  readonly liquidity: bigint;
  readonly amount0Max: bigint;
  readonly amount1Max: bigint;
}

export interface LiquidityMigrationPlan {
  readonly destinationPoolKey: {
    readonly currency0: Address;
    readonly currency1: Address;
    readonly fee: number;
    readonly tickSpacing: number;
    readonly hooks: Address;
  };
  readonly removals: readonly LiquidityMigrationRemoval[];
  readonly replacements: readonly LiquidityMigrationReplacement[];
  readonly deadline: bigint;
}

/** Encodes only LiquidityManager's reviewed migration plan; it does not build or guess Universal Router commands. */
export function buildLiquidityMigration(liquidityManager: Address, plan: LiquidityMigrationPlan): ContractTransaction {
  if (plan.removals.length === 0 || plan.removals.length > 16) {
    throw new RangeError('removals length must be between 1 and 16');
  }
  if (plan.replacements.length === 0 || plan.replacements.length > 16) {
    throw new RangeError('replacements length must be between 1 and 16');
  }
  if (new Set(plan.removals.map(({ positionId }) => positionId)).size !== plan.removals.length) {
    throw new RangeError('duplicate migration positionId');
  }
  if (
    !Number.isInteger(plan.destinationPoolKey.fee) ||
    plan.destinationPoolKey.fee < 0 ||
    plan.destinationPoolKey.fee >= 2 ** 24
  ) {
    throw new RangeError('fee must fit uint24');
  }
  const validateTick = (tick: number, name: string) => {
    if (!Number.isInteger(tick) || tick < -(2 ** 23) || tick >= 2 ** 23) throw new RangeError(`${name} must fit int24`);
  };
  validateTick(plan.destinationPoolKey.tickSpacing, 'tickSpacing');
  plan.removals.forEach((removal) => {
    assertUint(removal.positionId, 256, 'positionId');
    assertUint(removal.amount0Min, 128, 'amount0Min');
    assertUint(removal.amount1Min, 128, 'amount1Min');
  });
  plan.replacements.forEach((replacement) => {
    validateTick(replacement.tickLower, 'tickLower');
    validateTick(replacement.tickUpper, 'tickUpper');
    if (replacement.tickLower >= replacement.tickUpper) throw new RangeError('tickLower must be below tickUpper');
    positiveAmount(replacement.liquidity, 'liquidity');
    assertUint(replacement.liquidity, 128, 'liquidity');
    assertUint(replacement.amount0Max, 128, 'amount0Max');
    assertUint(replacement.amount1Max, 128, 'amount1Max');
  });
  positiveAmount(plan.deadline, 'deadline');
  const destinationPoolKey = {
    ...plan.destinationPoolKey,
    currency0: getAddress(plan.destinationPoolKey.currency0),
    currency1: getAddress(plan.destinationPoolKey.currency1),
    hooks: getAddress(plan.destinationPoolKey.hooks),
  };
  if (destinationPoolKey.currency0.toLowerCase() >= destinationPoolKey.currency1.toLowerCase()) {
    throw new RangeError('destination currencies must be strictly address-sorted');
  }
  return transaction(
    liquidityManager,
    encodeFunctionData({
      abi: liquidityManagerAbi,
      functionName: 'migrateLiquidity',
      args: [{ ...plan, destinationPoolKey, removals: [...plan.removals], replacements: [...plan.replacements] }],
    }),
  );
}
