const DEFAULT_PRECISION = 10n ** 18n;
const DEFAULT_STREAM_DURATION = 7n * 24n * 60n * 60n;
const MIN_REVENUE_AMOUNT = DEFAULT_STREAM_DURATION;

function requireNonNegative(value: bigint, label: string): void {
  if (value < 0n) throw new RangeError(`${label} must be non-negative`);
}

function ceilDiv(value: bigint, divisor: bigint): bigint {
  return value === 0n ? 0n : (value - 1n) / divisor + 1n;
}

/** Independent integer model of Resonance's scaled-carry revenue allocator. */
export class RevenueConservationModel {
  readonly precision: bigint;
  readonly weights: bigint[];
  readonly strategyIndex: bigint[];
  readonly remainders: bigint[];
  readonly claimable: bigint[];
  alive: boolean[];
  totalWeight = 0n;
  revenueIndex = 0n;
  pendingScaled = 0n;
  indexedScaled = 0n;
  fundLiability = 0n;
  accounted = 0n;
  now = 0n;
  streamRateScaled = 0n;
  streamRemainingScaled = 0n;
  streamLastUpdate = 0n;
  streamFinish = 0n;

  constructor(strategyCount: number, precision = DEFAULT_PRECISION) {
    if (!Number.isSafeInteger(strategyCount) || strategyCount <= 0) throw new RangeError('invalid strategyCount');
    if (precision <= 0n) throw new RangeError('precision must be positive');
    this.precision = precision;
    this.weights = Array<bigint>(strategyCount).fill(0n);
    this.strategyIndex = Array<bigint>(strategyCount).fill(0n);
    this.remainders = Array<bigint>(strategyCount).fill(0n);
    this.claimable = Array<bigint>(strategyCount).fill(0n);
    this.alive = Array<boolean>(strategyCount).fill(true);
  }

  notify(amount: bigint): void {
    requireNonNegative(amount, 'amount');
    if (amount < MIN_REVENUE_AMOUNT) throw new RangeError('amount is below the stream-duration minimum');
    const remaining = this.leftRevenue();
    if (amount <= remaining) throw new RangeError('amount does not exceed the active stream remainder');

    this.checkpointRevenue();
    this.accounted += amount;
    const combinedScaled = this.streamRemainingScaled + amount * this.precision;
    this.startStream(combinedScaled, this.now);
  }

  leftRevenue(): bigint {
    return (this.streamRemainingScaled - this.releasableScaled()) / this.precision;
  }

  canNotify(amount: bigint): boolean {
    return amount >= MIN_REVENUE_AMOUNT && amount > this.leftRevenue();
  }

  advance(seconds: bigint): void {
    requireNonNegative(seconds, 'seconds');
    this.now += seconds;
  }

  checkpointRevenue(): void {
    const released = this.releasableScaled();
    if (released !== 0n) {
      this.streamRemainingScaled -= released;
      this.streamLastUpdate = this.now;
      this.pendingScaled += released;
      if (this.streamRemainingScaled === 0n) this.clearStream();
    }
    this.indexPending();
  }

  private startStream(amountScaled: bigint, startedAt: bigint): void {
    this.streamRateScaled = ceilDiv(amountScaled, DEFAULT_STREAM_DURATION);
    this.streamRemainingScaled = amountScaled;
    this.streamLastUpdate = startedAt;
    this.streamFinish = startedAt + DEFAULT_STREAM_DURATION;
  }

  private releasableScaled(): bigint {
    if (this.streamRemainingScaled === 0n || this.now <= this.streamLastUpdate) return 0n;
    if (this.now >= this.streamFinish) return this.streamRemainingScaled;
    return this.streamRateScaled * (this.now - this.streamLastUpdate);
  }

  private clearStream(): void {
    this.streamRateScaled = 0n;
    this.streamRemainingScaled = 0n;
    this.streamLastUpdate = 0n;
    this.streamFinish = 0n;
  }

  indexPending(): void {
    if (this.totalWeight === 0n) {
      this.fundLiability += this.pendingScaled / this.precision;
      this.pendingScaled %= this.precision;
      return;
    }
    const delta = this.pendingScaled / this.totalWeight;
    const indexed = delta * this.totalWeight;
    this.pendingScaled -= indexed;
    this.indexedScaled += indexed;
    this.revenueIndex += delta;
  }

  checkpoint(strategy: number): void {
    this.checkpointRevenue();
    this.updateStrategy(strategy);
  }

  private updateStrategy(strategy: number): void {
    const delta = this.revenueIndex - this.strategyIndex[strategy]!;
    this.strategyIndex[strategy] = this.revenueIndex;
    const newlyIndexed = this.weights[strategy]! * delta;
    this.indexedScaled -= newlyIndexed;
    const accrued = this.remainders[strategy]! + newlyIndexed;
    const whole = accrued / this.precision;
    this.remainders[strategy] = accrued % this.precision;
    if (this.alive[strategy]) this.claimable[strategy] = this.claimable[strategy]! + whole;
    else this.fundLiability += whole;
  }

  setWeight(strategy: number, weight: bigint): void {
    requireNonNegative(weight, 'weight');
    this.checkpointRevenue();
    this.updateStrategy(strategy);
    const prior = this.weights[strategy]!;
    this.weights[strategy] = weight;
    this.totalWeight += weight - prior;
    if (weight === 0n) {
      this.pendingScaled += this.remainders[strategy]!;
      this.remainders[strategy] = 0n;
    }
    this.indexPending();
  }

  kill(strategy: number): void {
    this.checkpointRevenue();
    this.updateStrategy(strategy);
    this.fundLiability += this.claimable[strategy]!;
    this.claimable[strategy] = 0n;
    this.alive[strategy] = false;
  }

  classifiedScaled(): bigint {
    const whole = this.claimable.reduce((sum, value) => sum + value, this.fundLiability);
    return (
      this.pendingScaled +
      this.indexedScaled +
      this.streamRemainingScaled +
      this.remainders.reduce((sum, value) => sum + value, 0n) +
      whole * this.precision
    );
  }
}

/** Exact whole-token emission over the first `elapsed` active seconds of a fixed-duration stream. */
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
  accounted = 0n;

  constructor(weights: bigint[], precision = DEFAULT_PRECISION) {
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

  classifiedScaled(): bigint {
    return (
      this.pendingScaled +
      this.indexedScaled +
      this.userRemainders.reduce((sum, value) => sum + value, 0n) +
      this.liabilities.reduce((sum, value) => sum + value, 0n) * this.precision
    );
  }
}
