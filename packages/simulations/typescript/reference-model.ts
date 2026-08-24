import {
  auctionPriceAt,
  currentTotalSupply,
  earnedStrategyReward,
  miningRateAt,
  netSupplyChange,
  nextAuctionInitPrice,
  previewRedemption,
  projectTotalSupply,
  quoteMiningAccrual,
  quoteMiningPayment,
  quoteMiningPrice,
  redemptionPercentageWad,
  settleStrategyPayment,
  updateRewardIndex,
} from '@gumball-6900/sdk';

type StringRecord = Record<string, unknown>;
const INITIAL_SUPPLY = 0n;

export interface ReferenceScenarios extends StringRecord {
  schemaVersion: string;
  usdGDecimals: string;
  targetDecimals: string;
  miningCases: StringRecord[];
  auctionCases: StringRecord[];
  rewardCases: StringRecord[];
  redemptionCases: StringRecord[];
  supplyCases: StringRecord[];
}

const record = (value: unknown, label: string): StringRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError(`${label} must be object`);
  return value as StringRecord;
};
const text = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !/^-?\d+$/u.test(value))
    throw new TypeError(`${label} must be a decimal integer string`);
  return value;
};
const id = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value;
};
const array = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be array`);
  return value;
};

export function parseReferenceScenarios(value: unknown): ReferenceScenarios {
  const root = record(value, 'scenarios');
  const parseCases = (key: string): StringRecord[] =>
    array(root[key], key).map((entry, index) => {
      const parsed = record(entry, `${key}[${index}]`);
      id(parsed.id, `${key}[${index}].id`);
      return parsed;
    });
  return {
    schemaVersion: text(root.schemaVersion, 'schemaVersion'),
    usdGDecimals: text(root.usdGDecimals, 'usdGDecimals'),
    targetDecimals: text(root.targetDecimals, 'targetDecimals'),
    miningCases: parseCases('miningCases'),
    auctionCases: parseCases('auctionCases'),
    rewardCases: parseCases('rewardCases'),
    redemptionCases: parseCases('redemptionCases'),
    supplyCases: parseCases('supplyCases'),
  };
}

const big = (entry: StringRecord, key: string): bigint => BigInt(text(entry[key], key));
const decimal = (value: bigint): string => value.toString();

function synchronizedMiningEmission(
  elapsedSinceStart: bigint,
  curve: { halvingPeriod: bigint; initialTps: bigint; tailTps: bigint },
): bigint {
  if (elapsedSinceStart < 0n || curve.halvingPeriod <= 0n || curve.initialTps <= 0n || curve.tailTps <= 0n) {
    throw new RangeError('invalid synchronized mining input');
  }

  let emission = 0n;
  let remaining = elapsedSinceStart;
  for (let era = 0n; era < 256n; era += 1n) {
    if (remaining === 0n) return emission;
    const shifted = curve.initialTps >> era;
    if (shifted <= curve.tailTps) return emission + curve.tailTps * remaining;
    const activeSeconds = remaining < curve.halvingPeriod ? remaining : curve.halvingPeriod;
    emission += shifted * activeSeconds;
    remaining -= activeSeconds;
  }
  throw new RangeError('positive tail must be reached within uint256 shift bounds');
}

export function computeReferenceResults(scenarios: ReferenceScenarios) {
  const miningQuotes = scenarios.miningCases.map((entry) => {
    const slotTps = array(entry.slotTps, 'slotTps').map((value) => BigInt(text(value, 'slotTps')));
    const accrual = quoteMiningAccrual({ elapsedSeconds: big(entry, 'accrualSeconds'), slotTps });
    const curve = {
      halvingPeriod: big(entry, 'halvingPeriod'),
      initialTps: big(entry, 'initialTps'),
      tailTps: big(entry, 'tailTps'),
    };
    const nextGlobalTps = miningRateAt(big(entry, 'elapsedSinceStart'), curve);
    const synchronizedEmission = synchronizedMiningEmission(big(entry, 'elapsedSinceStart'), curve);
    const payment = quoteMiningPayment(big(entry, 'payment'), entry.hasPreviousMiner === true);
    return {
      id: id(entry.id, 'id'),
      price: decimal(quoteMiningPrice(big(entry, 'initialPrice'), big(entry, 'elapsedSeconds'))),
      previousMinerAmount: decimal(payment.previousMinerAmount),
      resonanceAmount: decimal(payment.resonanceAmount),
      slotEmissions: accrual.slotEmissions.map(decimal),
      totalEmission: decimal(accrual.totalEmission),
      nextGlobalTps: decimal(nextGlobalTps),
      nextSlotTps: decimal(nextGlobalTps / 16n),
      synchronizedMiningEmission: decimal(synchronizedEmission),
      synchronizedGrossSupply: decimal(INITIAL_SUPPLY + synchronizedEmission),
    };
  });

  const auctionQuotes = scenarios.auctionCases.map((entry) => {
    const payment = auctionPriceAt(big(entry, 'initPrice'), big(entry, 'elapsedSeconds'), big(entry, 'epochPeriod'));
    const bribeBasisPoints = big(entry, 'bribeBps');
    const partitionBribeBasisPoints = array(entry.paymentPartitionBps, 'paymentPartitionBps').map((raw) =>
      BigInt(text(raw, 'paymentPartitionBps')),
    );
    const paymentPartitions = array(entry.paymentPartitions, 'paymentPartitions');
    if (partitionBribeBasisPoints.length !== paymentPartitions.length) {
      throw new RangeError('every payment partition needs one Bribe rate');
    }
    const settlement = settleStrategyPayment(big(entry, 'actualTargetReceived'), bribeBasisPoints);
    let partitionFundAmount = 0n;
    let partitionBribeAmount = 0n;
    for (const [index, raw] of paymentPartitions.entries()) {
      const part = BigInt(text(raw, 'paymentPartitions'));
      const classified = settleStrategyPayment(part, partitionBribeBasisPoints[index]!);
      partitionFundAmount += classified.fundAmount;
      partitionBribeAmount += classified.bribeAmount;
    }
    return {
      id: id(entry.id, 'id'),
      paymentAmount: decimal(payment),
      nextInitPrice: decimal(nextAuctionInitPrice(payment, big(entry, 'priceMultiplier'), big(entry, 'minInitPrice'))),
      bribeBasisPoints: decimal(bribeBasisPoints),
      fundAmount: decimal(settlement.fundAmount),
      bribeAmount: decimal(settlement.bribeAmount),
      partitionFundAmount: decimal(partitionFundAmount),
      partitionBribeAmount: decimal(partitionBribeAmount),
      partitionBribeBasisPoints: partitionBribeBasisPoints.map(decimal),
    };
  });

  const rewardQuotes = scenarios.rewardCases.map((entry) => {
    const update = updateRewardIndex(
      big(entry, 'rewardAmount'),
      big(entry, 'totalActiveWeight'),
      big(entry, 'precision'),
    );
    return {
      id: id(entry.id, 'id'),
      rewardPerWeightIncrement: decimal(update.rewardPerWeightIncrement),
      indexedReward: decimal(update.indexedReward),
      residue: decimal(update.residue),
      userEarned: decimal(
        earnedStrategyReward(
          big(entry, 'userActiveWeight'),
          update.rewardPerWeightIncrement,
          big(entry, 'userRewardPerWeightPaid'),
          big(entry, 'userAccrued'),
          big(entry, 'precision'),
        ),
      ),
    };
  });

  const redemptionQuotes = scenarios.redemptionCases.map((entry) => {
    const shares = big(entry, 'shares');
    const supplyBefore = big(entry, 'supplyBefore');
    const assets = array(entry.assets, 'assets').map((asset) => {
      const parsed = record(asset, 'asset');
      return { asset: id(parsed.asset, 'asset'), balance: BigInt(text(parsed.balance, 'balance')) };
    });
    return {
      id: id(entry.id, 'id'),
      percentageWad: decimal(redemptionPercentageWad(shares, supplyBefore)),
      outputs: previewRedemption(shares, supplyBefore, assets).map(({ asset, amount }) => ({
        asset,
        amount: decimal(amount),
      })),
    };
  });

  const supplyQuotes = scenarios.supplyCases.map((entry) => {
    const lifetimeMinted = big(entry, 'lifetimeMinted');
    const lifetimeBurned = big(entry, 'lifetimeBurned');
    const supply = currentTotalSupply(lifetimeMinted, lifetimeBurned);
    return {
      id: id(entry.id, 'id'),
      currentSupply: decimal(supply),
      netSupplyChange: decimal(netSupplyChange(big(entry, 'gbxMined'), big(entry, 'gbxBurned'))),
      projectedSupply: decimal(projectTotalSupply(supply, big(entry, 'gbxMined'), big(entry, 'gbxBurned'))),
    };
  });

  return {
    schemaVersion: scenarios.schemaVersion,
    usdGDecimals: scenarios.usdGDecimals,
    targetDecimals: scenarios.targetDecimals,
    infiniteSupply: true,
    initialSupply: INITIAL_SUPPLY.toString(),
    miningQuotes,
    auctionQuotes,
    rewardQuotes,
    redemptionQuotes,
    supplyQuotes,
  };
}
