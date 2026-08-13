const DEFAULT_REVENUE_PRECISION = 10n ** 36n;
const DEFAULT_REWARD_PRECISION = 10n ** 18n;
const DEFAULT_STREAM_DURATION = 7n * 24n * 60n * 60n;

function requireNonNegative(value: bigint, label: string): void {
  if (value < 0n) throw new RangeError(`${label} must be non-negative`);
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
  fundRemainderScaled = 0n;
  accounted = 0n;
  now = 0n;
  queuedRevenue = 0n;
  streamRateScaled = 0n;
  streamRemainderFinish = 0n;
  streamRemainingScaled = 0n;
  streamLastUpdate = 0n;
  streamFinish = 0n;

  constructor(strategyCount: number, precision = DEFAULT_REVENUE_PRECISION) {
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
    if (amount <= 0n) throw new RangeError('amount must be positive');

    this.checkpointRevenue();
    this.accounted += amount;
    if (this.streamRemainingScaled === 0n) this.startStream(amount * this.precision, this.now);
    else this.queuedRevenue += amount;
  }

  advance(seconds: bigint): void {
    requireNonNegative(seconds, 'seconds');
    this.now += seconds;
  }

  checkpointRevenue(): void {
    if (this.streamRemainingScaled !== 0n) {
      const firstFinish = this.streamFinish;
      this.accrueUntil(this.now < firstFinish ? this.now : firstFinish);
      if (this.now >= firstFinish) {
        this.clearStream();
        if (this.queuedRevenue !== 0n) {
          const queued = this.queuedRevenue;
          this.queuedRevenue = 0n;
          this.startStream(queued * this.precision, firstFinish);
          this.accrueUntil(this.now < this.streamFinish ? this.now : this.streamFinish);
          if (this.now >= this.streamFinish) this.clearStream();
        }
      }
    }
    this.indexPending();
  }

  private startStream(amountScaled: bigint, startedAt: bigint): void {
    const rateRemainder = amountScaled % DEFAULT_STREAM_DURATION;
    this.streamRateScaled = amountScaled / DEFAULT_STREAM_DURATION;
    this.streamRemainderFinish = startedAt + rateRemainder;
    this.streamRemainingScaled = amountScaled;
    this.streamLastUpdate = startedAt;
    this.streamFinish = startedAt + DEFAULT_STREAM_DURATION;
  }

  private accrueUntil(timestamp: bigint): void {
    const from = this.streamLastUpdate;
    if (timestamp <= from) return;
    let released = (timestamp - from) * this.streamRateScaled;
    if (from < this.streamRemainderFinish) {
      const remainderEnd = timestamp < this.streamRemainderFinish ? timestamp : this.streamRemainderFinish;
      released += remainderEnd - from;
    }
    this.streamRemainingScaled -= released;
    this.streamLastUpdate = timestamp;
    this.pendingScaled += released;
  }

  private clearStream(): void {
    this.streamRateScaled = 0n;
    this.streamRemainderFinish = 0n;
    this.streamRemainingScaled = 0n;
    this.streamLastUpdate = 0n;
    this.streamFinish = 0n;
  }

  indexPending(): void {
    if (this.totalWeight === 0n) {
      this.accrueFundScaled(this.pendingScaled);
      this.pendingScaled = 0n;
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
    this.accrueFundScaled(this.pendingScaled);
    this.pendingScaled = 0n;
    const prior = this.weights[strategy]!;
    this.weights[strategy] = weight;
    this.totalWeight += weight - prior;
    if (weight === 0n) {
      this.accrueFundScaled(this.remainders[strategy]!);
      this.remainders[strategy] = 0n;
    }
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
      this.queuedRevenue * this.precision +
      this.fundRemainderScaled +
      this.remainders.reduce((sum, value) => sum + value, 0n) +
      whole * this.precision
    );
  }

  private accrueFundScaled(amountScaled: bigint): void {
    const combined = this.fundRemainderScaled + amountScaled;
    this.fundLiability += combined / this.precision;
    this.fundRemainderScaled = combined % this.precision;
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
