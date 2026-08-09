"""Independent integer models for exact Resonance and Bribe accounting."""

from dataclasses import dataclass, field


def exact_stream_emission(amount: int, duration: int, elapsed: int) -> int:
    if amount < 0 or elapsed < 0 or duration <= 0:
        raise ValueError("invalid stream input")
    active = min(elapsed, duration)
    return active * (amount // duration) + min(active, amount % duration)


@dataclass
class RevenueConservationModel:
    strategy_count: int
    precision: int = 10**18
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
    accounted: int = 0

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
            self.fund_liability += self.pending_scaled // self.precision
            self.pending_scaled %= self.precision
            return
        delta = self.pending_scaled // self.total_weight
        indexed = delta * self.total_weight
        self.pending_scaled -= indexed
        self.indexed_scaled += indexed
        self.revenue_index += delta

    def notify(self, amount: int) -> None:
        if amount < 0:
            raise ValueError("amount must be non-negative")
        self.accounted += amount
        if self.total_weight == 0:
            self.fund_liability += amount
        else:
            self.pending_scaled += amount * self.precision
        self.index_pending()

    def checkpoint(self, strategy: int) -> None:
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
        self.index_pending()
        self.checkpoint(strategy)
        prior = self.weights[strategy]
        self.weights[strategy] = weight
        self.total_weight += weight - prior
        if weight == 0:
            self.pending_scaled += self.remainders[strategy]
            self.remainders[strategy] = 0
        self.index_pending()

    def kill(self, strategy: int) -> None:
        self.index_pending()
        self.checkpoint(strategy)
        self.fund_liability += self.claimable[strategy]
        self.claimable[strategy] = 0
        self.alive[strategy] = False

    def classified_scaled(self) -> int:
        return (
            self.pending_scaled
            + self.indexed_scaled
            + sum(self.remainders)
            + (sum(self.claimable) + self.fund_liability) * self.precision
        )


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

    def classified_scaled(self) -> int:
        return (
            self.pending_scaled
            + self.indexed_scaled
            + sum(self.user_remainders)
            + sum(self.liabilities) * self.precision
        )
