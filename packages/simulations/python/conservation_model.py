"""Independent integer models for exact Resonance and Bribe accounting."""

from dataclasses import dataclass, field


STREAM_DURATION = 7 * 24 * 60 * 60


def exact_stream_emission(amount: int, duration: int, elapsed: int) -> int:
    if amount < 0 or elapsed < 0 or duration <= 0:
        raise ValueError("invalid stream input")
    active = min(elapsed, duration)
    return active * (amount // duration) + min(active, amount % duration)


@dataclass
class RevenueConservationModel:
    strategy_count: int
    precision: int = 10**36
    weights: list[int] = field(init=False)
    strategy_index: list[int] = field(init=False)
    remainders: list[int] = field(init=False)
    claimable: list[int] = field(init=False)
    alive: list[bool] = field(init=False)
    total_weight: int = 0
    revenue_index: int = 0
    pending_scaled: int = 0
    indexed_scaled: int = 0
    fund_liability: int = 0
    fund_remainder_scaled: int = 0
    accounted: int = 0
    now: int = 0
    queued_revenue: int = 0
    stream_rate_scaled: int = 0
    stream_remainder_finish: int = 0
    stream_remaining_scaled: int = 0
    stream_last_update: int = 0
    stream_finish: int = 0

    def __post_init__(self) -> None:
        if self.strategy_count <= 0 or self.precision <= 0:
            raise ValueError("invalid model dimensions")
        self.weights = [0] * self.strategy_count
        self.strategy_index = [0] * self.strategy_count
        self.remainders = [0] * self.strategy_count
        self.claimable = [0] * self.strategy_count
        self.alive = [True] * self.strategy_count

    def index_pending(self) -> None:
        if self.total_weight == 0:
            self._accrue_fund_scaled(self.pending_scaled)
            self.pending_scaled = 0
            return
        delta = self.pending_scaled // self.total_weight
        indexed = delta * self.total_weight
        self.pending_scaled -= indexed
        self.indexed_scaled += indexed
        self.revenue_index += delta

    def notify(self, amount: int) -> None:
        if amount <= 0:
            raise ValueError("amount must be positive")

        self.checkpoint_revenue()
        self.accounted += amount
        if self.stream_remaining_scaled == 0:
            self._start_stream(amount * self.precision, self.now)
        else:
            self.queued_revenue += amount

    def advance(self, seconds: int) -> None:
        if seconds < 0:
            raise ValueError("seconds must be non-negative")
        self.now += seconds

    def checkpoint_revenue(self) -> None:
        if self.stream_remaining_scaled:
            first_finish = self.stream_finish
            self._accrue_until(min(self.now, first_finish))
            if self.now >= first_finish:
                self._clear_stream()
                if self.queued_revenue:
                    queued = self.queued_revenue
                    self.queued_revenue = 0
                    self._start_stream(queued * self.precision, first_finish)
                    self._accrue_until(min(self.now, self.stream_finish))
                    if self.now >= self.stream_finish:
                        self._clear_stream()
        self.index_pending()

    def _start_stream(self, amount_scaled: int, started_at: int) -> None:
        self.stream_rate_scaled, rate_remainder = divmod(amount_scaled, STREAM_DURATION)
        self.stream_remainder_finish = started_at + rate_remainder
        self.stream_remaining_scaled = amount_scaled
        self.stream_last_update = started_at
        self.stream_finish = started_at + STREAM_DURATION

    def _accrue_until(self, timestamp: int) -> None:
        start = self.stream_last_update
        if timestamp <= start:
            return
        released = (timestamp - start) * self.stream_rate_scaled
        if start < self.stream_remainder_finish:
            released += min(timestamp, self.stream_remainder_finish) - start
        self.stream_remaining_scaled -= released
        self.stream_last_update = timestamp
        self.pending_scaled += released

    def _clear_stream(self) -> None:
        self.stream_rate_scaled = 0
        self.stream_remainder_finish = 0
        self.stream_remaining_scaled = 0
        self.stream_last_update = 0
        self.stream_finish = 0

    def checkpoint(self, strategy: int) -> None:
        self.checkpoint_revenue()
        self._update_strategy(strategy)

    def _update_strategy(self, strategy: int) -> None:
        delta = self.revenue_index - self.strategy_index[strategy]
        self.strategy_index[strategy] = self.revenue_index
        newly_indexed = self.weights[strategy] * delta
        self.indexed_scaled -= newly_indexed
        accrued = self.remainders[strategy] + newly_indexed
        whole, self.remainders[strategy] = divmod(accrued, self.precision)
        if self.alive[strategy]:
            self.claimable[strategy] += whole
        else:
            self.fund_liability += whole

    def set_weight(self, strategy: int, weight: int) -> None:
        if weight < 0:
            raise ValueError("weight must be non-negative")
        self.checkpoint_revenue()
        self._update_strategy(strategy)
        self._accrue_fund_scaled(self.pending_scaled)
        self.pending_scaled = 0
        prior = self.weights[strategy]
        self.weights[strategy] = weight
        self.total_weight += weight - prior
        if weight == 0:
            self._accrue_fund_scaled(self.remainders[strategy])
            self.remainders[strategy] = 0

    def kill(self, strategy: int) -> None:
        self.checkpoint_revenue()
        self._update_strategy(strategy)
        self.fund_liability += self.claimable[strategy]
        self.claimable[strategy] = 0
        self.alive[strategy] = False

    def classified_scaled(self) -> int:
        return (
            self.pending_scaled
            + self.indexed_scaled
            + self.stream_remaining_scaled
            + self.queued_revenue * self.precision
            + self.fund_remainder_scaled
            + sum(self.remainders)
            + (sum(self.claimable) + self.fund_liability) * self.precision
        )

    def _accrue_fund_scaled(self, amount_scaled: int) -> None:
        combined = self.fund_remainder_scaled + amount_scaled
        whole, self.fund_remainder_scaled = divmod(combined, self.precision)
        self.fund_liability += whole


@dataclass
class RewardConservationModel:
    weights: list[int]
    precision: int = 10**18
    user_index: list[int] = field(init=False)
    user_remainders: list[int] = field(init=False)
    liabilities: list[int] = field(init=False)
    total_weight: int = field(init=False)
    reward_index: int = 0
    pending_scaled: int = 0
    indexed_scaled: int = 0
    fund_liability: int = 0
    fund_remainder_scaled: int = 0
    accounted: int = 0

    def __post_init__(self) -> None:
        if self.precision <= 0 or any(weight < 0 for weight in self.weights):
            raise ValueError("invalid reward model")
        self.total_weight = sum(self.weights)
        self.user_index = [0] * len(self.weights)
        self.user_remainders = [0] * len(self.weights)
        self.liabilities = [0] * len(self.weights)

    def emit(self, amount: int) -> None:
        if amount < 0:
            raise ValueError("amount must be non-negative")
        self.accounted += amount
        self.pending_scaled += amount * self.precision
        if self.total_weight == 0:
            return
        delta = self.pending_scaled // self.total_weight
        indexed = delta * self.total_weight
        self.pending_scaled -= indexed
        self.indexed_scaled += indexed
        self.reward_index += delta

    def checkpoint(self, user: int) -> None:
        newly_indexed = self.weights[user] * (self.reward_index - self.user_index[user])
        self.user_index[user] = self.reward_index
        self.indexed_scaled -= newly_indexed
        accrued = self.user_remainders[user] + newly_indexed
        if self.weights[user] != 0 and self.weights[user] == self.total_weight:
            accrued += self.pending_scaled
            self.pending_scaled = 0
        whole, self.user_remainders[user] = divmod(accrued, self.precision)
        self.liabilities[user] += whole

    def set_weight(self, user: int, weight: int) -> None:
        if weight < 0:
            raise ValueError("weight must be non-negative")
        self.checkpoint(user)
        self._accrue_fund_scaled(self.pending_scaled)
        self.pending_scaled = 0
        prior = self.weights[user]
        self.weights[user] = weight
        self.total_weight += weight - prior
        if weight == 0:
            self._accrue_fund_scaled(self.user_remainders[user])
            self.user_remainders[user] = 0

    def classified_scaled(self) -> int:
        return (
            self.pending_scaled
            + self.indexed_scaled
            + self.fund_remainder_scaled
            + sum(self.user_remainders)
            + (sum(self.liabilities) + self.fund_liability) * self.precision
        )

    def _accrue_fund_scaled(self, amount_scaled: int) -> None:
        combined = self.fund_remainder_scaled + amount_scaled
        whole, self.fund_remainder_scaled = divmod(combined, self.precision)
        self.fund_liability += whole
