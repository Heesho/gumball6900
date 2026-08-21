const DEFAULT_REVENUE_PRECISION = 10n ** 36n;
const DEFAULT_REWARD_PRECISION = 10n ** 36n;
const DEFAULT_STREAM_DURATION = 7n * 24n * 60n * 60n;
const SETTLEMENT_BPS = 10_000n;
const DEFAULT_SETTLEMENT_BRIBE_BPS = 1_000n;
const MAX_SETTLEMENT_BRIBE_BPS = 2_000n;

function requireNonNegative(value: bigint, label: string): void {
  if (value < 0n) throw new RangeError(`${label} must be non-negative`);
}

/** Independent state model for mutable-rate cumulative BribeRouter classification and isolated settlement. */
export class StrategyPaymentConservationModel {
  bribeBps = DEFAULT_SETTLEMENT_BRIBE_BPS;
  fundLiability = 0n;
  bribeLiability = 0n;
  splitRemainder = 0n;
  accountedBalance = 0n;
  balance = 0n;

  setBribeBps(newBribeBps: bigint): void {
    if (newBribeBps < 0n || newBribeBps > MAX_SETTLEMENT_BRIBE_BPS) {
      throw new RangeError('bribe basis points outside protocol bounds');
    }
    this.bribeBps = newBribeBps;
  }

  route(payment: bigint): void {
    if (payment <= 0n) throw new RangeError('payment must be positive');
    const baseBribe = (payment * this.bribeBps) / SETTLEMENT_BPS;
    const accumulated = this.splitRemainder + ((payment * this.bribeBps) % SETTLEMENT_BPS);
    const bribeAmount = baseBribe + accumulated / SETTLEMENT_BPS;
    this.splitRemainder = accumulated % SETTLEMENT_BPS;
    this.fundLiability += payment - bribeAmount;
    this.bribeLiability += bribeAmount;
    this.accountedBalance += payment;
    this.balance += payment;
  }

  donate(amount: bigint): void {
    requireNonNegative(amount, 'amount');
    this.balance += amount;
  }

  payFund(): bigint {
    const amount = this.fundLiability;
    this.fundLiability = 0n;
    this.accountedBalance -= amount;
    this.balance -= amount;
    return amount;
  }

  notifyBribe(): bigint {
    const amount = this.bribeLiability;
    this.bribeLiability = 0n;
    this.accountedBalance -= amount;
    this.balance -= amount;
    return amount;
  }

  surplus(): bigint {
    return this.balance - this.accountedBalance;
  }
}

/** Independent integer model of Resonance's Bribe-shaped virtual-Strategy rewarder. */
export class RevenueConservationModel {
  readonly precision: bigint;
  readonly weights: bigint[];
  readonly strategyIndex: bigint[];
  readonly claimable: bigint[];
  readonly alive: boolean[];
  totalWeight = 0n;
  revenueIndex = 0n;
  accounted = 0n;
  donations = 0n;
  paid = 0n;
  balance = 0n;
  routerBalance = 0n;
  now = 0n;
  streamRate = 0n;
  streamRemainderFinish = 0n;
  streamLastUpdate = 0n;
  streamFinish = 0n;

  constructor(strategyCount: number, precision = DEFAULT_REVENUE_PRECISION) {
    if (!Number.isSafeInteger(strategyCount) || strategyCount <= 0) throw new RangeError('invalid strategyCount');
    if (precision <= 0n) throw new RangeError('precision must be positive');
    this.precision = precision;
    this.weights = Array<bigint>(strategyCount).fill(0n);
    this.strategyIndex = Array<bigint>(strategyCount).fill(0n);
    this.claimable = Array<bigint>(strategyCount).fill(0n);
    this.alive = Array<boolean>(strategyCount).fill(true);
  }

  /** Models an exact Router pull and qualifying live-period reset. */
  notify(amount: bigint): void {
    if (amount <= 0n) throw new RangeError('amount must be positive');

    const remaining = this.left();
    if (amount < remaining) throw new RangeError('reward smaller than left');

    this.checkpointRevenue();
    this.accounted += amount;
    this.balance += amount;
    this.startStream(amount + remaining);
  }

  /** Adds Router revenue and routes its complete balance once it meets the active-period threshold. */
  route(amount: bigint): bigint {
    requireNonNegative(amount, 'amount');
    this.routerBalance += amount;
    if (this.routerBalance === 0n) throw new RangeError('no revenue');
    if (this.routerBalance < this.left()) return 0n;

    const delivered = this.routerBalance;
    this.notify(delivered);
    this.routerBalance = 0n;
    return delivered;
  }

  /** Models a direct USDG transfer that is never scheduled by Resonance. */
  donate(amount: bigint): void {
    requireNonNegative(amount, 'amount');
    this.donations += amount;
    this.balance += amount;
  }

  advance(seconds: bigint): void {
    requireNonNegative(seconds, 'seconds');
    this.now += seconds;
  }

  /** Checkpoints the global reward index without updating any Strategy. */
  checkpointRevenue(): void {
    this.revenueIndex = this.rewardPerToken();
    this.streamLastUpdate = this.lastTimeRewardApplicable();
  }

  checkpoint(strategy: number): void {
    this.requireStrategy(strategy);
    this.checkpointRevenue();
    const activeWeight = this.alive[strategy] ? this.weights[strategy]! : 0n;
    const delta = this.revenueIndex - this.strategyIndex[strategy]!;
    this.claimable[strategy] = this.claimable[strategy]! + (activeWeight * delta) / this.precision;
    this.strategyIndex[strategy] = this.revenueIndex;
  }

  setWeight(strategy: number, weight: bigint): void {
    this.requireStrategy(strategy);
    requireNonNegative(weight, 'weight');
    const prior = this.weights[strategy]!;
    if (!this.alive[strategy] && weight > prior) throw new RangeError('strategy is dead');

    this.checkpoint(strategy);
    this.weights[strategy] = weight;
    if (this.alive[strategy]) this.totalWeight += weight - prior;
  }

  kill(strategy: number): void {
    this.requireStrategy(strategy);
    if (!this.alive[strategy]) throw new RangeError('strategy is dead');

    this.checkpoint(strategy);
    this.alive[strategy] = false;
    this.totalWeight -= this.weights[strategy]!;
  }

  claim(strategy: number): bigint {
    this.checkpoint(strategy);
    const amount = this.claimable[strategy]!;
    this.claimable[strategy] = 0n;
    this.paid += amount;
    this.balance -= amount;
    return amount;
  }

  lastTimeRewardApplicable(): bigint {
    return this.now < this.streamFinish ? this.now : this.streamFinish;
  }

  rewardPerToken(): bigint {
    if (this.totalWeight === 0n) return this.revenueIndex;
    const applicable = this.lastTimeRewardApplicable();
    if (applicable <= this.streamLastUpdate) return this.revenueIndex;
    const emitted = this.emissionBetween(this.streamLastUpdate, applicable);
    return this.revenueIndex + (emitted * this.precision) / this.totalWeight;
  }

  earned(strategy: number): bigint {
    this.requireStrategy(strategy);
    const activeWeight = this.alive[strategy] ? this.weights[strategy]! : 0n;
    const delta = this.rewardPerToken() - this.strategyIndex[strategy]!;
    return this.claimable[strategy]! + (activeWeight * delta) / this.precision;
  }

  /** Exact raw reward units not yet emitted by the active period. */
  left(): bigint {
    if (this.now >= this.streamFinish) return 0n;
    return this.emissionBetween(this.now, this.streamFinish);
  }

  /** Balance not represented by the active schedule or a whole-unit Strategy entitlement. */
  surplus(): bigint {
    const obligations = this.left() + this.alive.reduce((sum, _alive, index) => sum + this.earned(index), 0n);
    const amount = this.balance - obligations;
    if (amount < 0n) throw new RangeError('model is insolvent');
    return amount;
  }

  private startStream(amount: bigint): void {
    const rateRemainder = amount % DEFAULT_STREAM_DURATION;
    this.streamRate = amount / DEFAULT_STREAM_DURATION;
    this.streamRemainderFinish = this.now + rateRemainder;
    this.streamLastUpdate = this.now;
    this.streamFinish = this.now + DEFAULT_STREAM_DURATION;
  }

  private emissionBetween(from: bigint, to: bigint): bigint {
    if (to <= from) return 0n;
    let amount = (to - from) * this.streamRate;
    if (from < this.streamRemainderFinish) {
      const remainderEnd = to < this.streamRemainderFinish ? to : this.streamRemainderFinish;
      amount += remainderEnd - from;
    }
    return amount;
  }

  private requireStrategy(strategy: number): void {
    if (!Number.isSafeInteger(strategy) || strategy < 0 || strategy >= this.weights.length) {
      throw new RangeError('invalid strategy');
    }
  }
}

/** Exact whole-token emission over the first `elapsed` seconds of a fixed-duration stream. */
export function exactStreamEmission(amount: bigint, duration: bigint, elapsed: bigint): bigint {
  requireNonNegative(amount, 'amount');
  if (duration <= 0n) throw new RangeError('duration must be positive');
  requireNonNegative(elapsed, 'elapsed');
  const active = elapsed < duration ? elapsed : duration;
  return active * (amount / duration) + (active < amount % duration ? active : amount % duration);
}

/** Independent scaled-carry reward allocation model for fixed virtual balances. */
export class RewardConservationModel {
  readonly precision: bigint;
  readonly weights: bigint[];
  readonly userIndex: bigint[];
  readonly userRemainders: bigint[];
  readonly liabilities: bigint[];
  totalWeight: bigint;
  rewardIndex = 0n;
  pendingScaled = 0n;
  indexedScaled = 0n;
  fundLiability = 0n;
  fundRemainderScaled = 0n;
  accounted = 0n;

  constructor(weights: bigint[], precision = DEFAULT_REWARD_PRECISION) {
    if (precision <= 0n) throw new RangeError('precision must be positive');
    weights.forEach((weight) => requireNonNegative(weight, 'weight'));
    this.precision = precision;
    this.weights = [...weights];
    this.totalWeight = weights.reduce((sum, value) => sum + value, 0n);
    this.userIndex = Array<bigint>(weights.length).fill(0n);
    this.userRemainders = Array<bigint>(weights.length).fill(0n);
    this.liabilities = Array<bigint>(weights.length).fill(0n);
  }

  emit(amount: bigint): void {
    requireNonNegative(amount, 'amount');
    this.accounted += amount;
    this.pendingScaled += amount * this.precision;
    if (this.totalWeight === 0n) return;
    const delta = this.pendingScaled / this.totalWeight;
    const indexed = delta * this.totalWeight;
    this.pendingScaled -= indexed;
    this.indexedScaled += indexed;
    this.rewardIndex += delta;
  }

  checkpoint(user: number): void {
    const newlyIndexed = this.weights[user]! * (this.rewardIndex - this.userIndex[user]!);
    this.userIndex[user] = this.rewardIndex;
    this.indexedScaled -= newlyIndexed;
    let accrued = this.userRemainders[user]! + newlyIndexed;
    if (this.weights[user] !== 0n && this.weights[user] === this.totalWeight) {
      accrued += this.pendingScaled;
      this.pendingScaled = 0n;
    }
    this.liabilities[user] = this.liabilities[user]! + accrued / this.precision;
    this.userRemainders[user] = accrued % this.precision;
  }

  setWeight(user: number, weight: bigint): void {
    requireNonNegative(weight, 'weight');
    this.checkpoint(user);
    this.accrueFundScaled(this.pendingScaled);
    this.pendingScaled = 0n;
    const prior = this.weights[user]!;
    this.weights[user] = weight;
    this.totalWeight += weight - prior;
    if (weight === 0n) {
      this.accrueFundScaled(this.userRemainders[user]!);
      this.userRemainders[user] = 0n;
    }
  }

  classifiedScaled(): bigint {
    return (
      this.pendingScaled +
      this.indexedScaled +
      this.fundRemainderScaled +
      this.userRemainders.reduce((sum, value) => sum + value, 0n) +
      (this.liabilities.reduce((sum, value) => sum + value, 0n) + this.fundLiability) * this.precision
    );
  }

  private accrueFundScaled(amountScaled: bigint): void {
    const combined = this.fundRemainderScaled + amountScaled;
    this.fundLiability += combined / this.precision;
    this.fundRemainderScaled = combined % this.precision;
  }
}
