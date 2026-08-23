const DEFAULT_PRECISION = 10n ** 36n;
const DEFAULT_STREAM_DURATION = 7n * 24n * 60n * 60n;
const SETTLEMENT_BPS = 10_000n;
const DEFAULT_SETTLEMENT_BRIBE_BPS = 1_000n;
const MAX_SETTLEMENT_BRIBE_BPS = 2_000n;

function requireNonNegative(value: bigint, label: string): void {
  if (value < 0n) throw new RangeError(`${label} must be non-negative`);
}

/** Independent model of Strategy's inline Fund split and the Bribe-only Router buffer. */
export class StrategyPaymentModel {
  bribeBps = DEFAULT_SETTLEMENT_BRIBE_BPS;
  fundReceived = 0n;
  routerBalance = 0n;

  setBribeBps(newBribeBps: bigint): void {
    if (newBribeBps < 0n || newBribeBps > MAX_SETTLEMENT_BRIBE_BPS) {
      throw new RangeError('bribe basis points outside protocol bounds');
    }
    this.bribeBps = newBribeBps;
  }

  buy(payment: bigint): { bribeAmount: bigint; fundAmount: bigint } {
    if (payment <= 0n) throw new RangeError('payment must be positive');
    const bribeAmount = (payment * this.bribeBps) / SETTLEMENT_BPS;
    const fundAmount = payment - bribeAmount;
    this.fundReceived += fundAmount;
    this.routerBalance += bribeAmount;
    return { bribeAmount, fundAmount };
  }

  donateToRouter(amount: bigint): void {
    requireNonNegative(amount, 'amount');
    this.routerBalance += amount;
  }

  distribute(minimumAmount: bigint, rewardLeft: bigint): bigint {
    requireNonNegative(minimumAmount, 'minimumAmount');
    requireNonNegative(rewardLeft, 'rewardLeft');
    if (this.routerBalance < minimumAmount || this.routerBalance < rewardLeft) return 0n;
    const amount = this.routerBalance;
    this.routerBalance = 0n;
    return amount;
  }
}

/** Independent integer model of Resonance's scalar Synthetix-style reward stream. */
export class RevenueDistributionModel {
  readonly duration: bigint;
  readonly precision: bigint;
  readonly weights: bigint[];
  readonly strategyIndex: bigint[];
  readonly claimable: bigint[];
  readonly alive: boolean[];
  totalWeight = 0n;
  revenueIndex = 0n;
  received = 0n;
  donations = 0n;
  paid = 0n;
  balance = 0n;
  routerBalance = 0n;
  now = 0n;
  streamRate = 0n;
  streamLastUpdate = 0n;
  streamFinish = 0n;

  constructor(strategyCount: number, precision = DEFAULT_PRECISION, duration = DEFAULT_STREAM_DURATION) {
    if (!Number.isSafeInteger(strategyCount) || strategyCount <= 0) throw new RangeError('invalid strategyCount');
    if (precision <= 0n || duration <= 0n) throw new RangeError('invalid reward configuration');
    this.precision = precision;
    this.duration = duration;
    this.weights = Array<bigint>(strategyCount).fill(0n);
    this.strategyIndex = Array<bigint>(strategyCount).fill(0n);
    this.claimable = Array<bigint>(strategyCount).fill(0n);
    this.alive = Array<boolean>(strategyCount).fill(true);
  }

  notify(amount: bigint): void {
    if (amount <= 0n) throw new RangeError('amount must be positive');
    const remaining = this.left();
    if (amount < remaining) throw new RangeError('reward smaller than left');
    this.checkpointRevenue();
    this.received += amount;
    this.balance += amount;
    this.streamRate = (amount + remaining) / this.duration;
    this.streamLastUpdate = this.now;
    this.streamFinish = this.now + this.duration;
  }

  route(amount: bigint): bigint {
    requireNonNegative(amount, 'amount');
    this.routerBalance += amount;
    if (this.routerBalance === 0n) throw new RangeError('no revenue');
    const threshold = this.left() > this.duration ? this.left() : this.duration;
    if (this.routerBalance < threshold) return 0n;
    const delivered = this.routerBalance;
    this.notify(delivered);
    this.routerBalance = 0n;
    return delivered;
  }

  donate(amount: bigint): void {
    requireNonNegative(amount, 'amount');
    this.donations += amount;
    this.balance += amount;
  }

  advance(seconds: bigint): void {
    requireNonNegative(seconds, 'seconds');
    this.now += seconds;
  }

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
    const emitted = (applicable - this.streamLastUpdate) * this.streamRate;
    return this.revenueIndex + (emitted * this.precision) / this.totalWeight;
  }

  earned(strategy: number): bigint {
    this.requireStrategy(strategy);
    const activeWeight = this.alive[strategy] ? this.weights[strategy]! : 0n;
    const delta = this.rewardPerToken() - this.strategyIndex[strategy]!;
    return this.claimable[strategy]! + (activeWeight * delta) / this.precision;
  }

  left(): bigint {
    return this.now >= this.streamFinish ? 0n : (this.streamFinish - this.now) * this.streamRate;
  }

  surplus(): bigint {
    const obligations = this.left() + this.alive.reduce((sum, _alive, index) => sum + this.earned(index), 0n);
    const amount = this.balance - obligations;
    if (amount < 0n) throw new RangeError('model is insolvent');
    return amount;
  }

  private requireStrategy(strategy: number): void {
    if (!Number.isSafeInteger(strategy) || strategy < 0 || strategy >= this.weights.length) {
      throw new RangeError('invalid strategy');
    }
  }
}

/** Whole raw units emitted by ordinary quotient-only Synthetix scheduling. */
export function synthetixStreamEmission(amount: bigint, duration: bigint, elapsed: bigint): bigint {
  requireNonNegative(amount, 'amount');
  if (duration <= 0n) throw new RangeError('duration must be positive');
  requireNonNegative(elapsed, 'elapsed');
  const active = elapsed < duration ? elapsed : duration;
  return active * (amount / duration);
}

/** Abstract cumulative-index model with ordinary global and per-user floors and no carry buckets. */
export class RewardDistributionModel {
  readonly precision: bigint;
  readonly weights: bigint[];
  readonly userIndex: bigint[];
  readonly accrued: bigint[];
  totalWeight: bigint;
  rewardIndex = 0n;
  received = 0n;

  constructor(weights: bigint[], precision = DEFAULT_PRECISION) {
    if (precision <= 0n) throw new RangeError('precision must be positive');
    weights.forEach((weight) => requireNonNegative(weight, 'weight'));
    this.precision = precision;
    this.weights = [...weights];
    this.totalWeight = weights.reduce((sum, value) => sum + value, 0n);
    this.userIndex = Array<bigint>(weights.length).fill(0n);
    this.accrued = Array<bigint>(weights.length).fill(0n);
  }

  emit(amount: bigint): void {
    requireNonNegative(amount, 'amount');
    this.received += amount;
    if (this.totalWeight !== 0n) this.rewardIndex += (amount * this.precision) / this.totalWeight;
  }

  earned(user: number): bigint {
    return this.accrued[user]! + (this.weights[user]! * (this.rewardIndex - this.userIndex[user]!)) / this.precision;
  }

  checkpoint(user: number): void {
    this.accrued[user] = this.earned(user);
    this.userIndex[user] = this.rewardIndex;
  }

  setWeight(user: number, weight: bigint): void {
    requireNonNegative(weight, 'weight');
    this.checkpoint(user);
    const prior = this.weights[user]!;
    this.weights[user] = weight;
    this.totalWeight += weight - prior;
  }

  surplus(): bigint {
    return this.received - this.weights.reduce((sum, _weight, user) => sum + this.earned(user), 0n);
  }
}
