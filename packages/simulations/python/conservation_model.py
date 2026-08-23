"""Independent integer models for the simplicity-first reward and payment boundaries."""

from dataclasses import dataclass, field


STREAM_DURATION = 7 * 24 * 60 * 60
SETTLEMENT_BPS = 10_000
DEFAULT_SETTLEMENT_BRIBE_BPS = 1_000
MAX_SETTLEMENT_BRIBE_BPS = 2_000


def synthetix_stream_emission(amount: int, duration: int, elapsed: int) -> int:
    if amount < 0 or elapsed < 0 or duration <= 0:
        raise ValueError("invalid stream input")
    return min(elapsed, duration) * (amount // duration)


@dataclass
class StrategyPaymentModel:
    """Strategy's inline Fund split plus the paired Bribe-only buffer."""

    bribe_bps: int = DEFAULT_SETTLEMENT_BRIBE_BPS
    fund_received: int = 0
    router_balance: int = 0

    def set_bribe_bps(self, new_bribe_bps: int) -> None:
        if new_bribe_bps < 0 or new_bribe_bps > MAX_SETTLEMENT_BRIBE_BPS:
            raise ValueError("bribe basis points outside protocol bounds")
        self.bribe_bps = new_bribe_bps

    def buy(self, payment: int) -> tuple[int, int]:
        if payment <= 0:
            raise ValueError("payment must be positive")
        bribe = payment * self.bribe_bps // SETTLEMENT_BPS
        fund = payment - bribe
        self.fund_received += fund
        self.router_balance += bribe
        return fund, bribe

    def donate_to_router(self, amount: int) -> None:
        if amount < 0:
            raise ValueError("amount must be non-negative")
        self.router_balance += amount

    def distribute(self, minimum_amount: int, reward_left: int) -> int:
        if minimum_amount < 0 or reward_left < 0:
            raise ValueError("thresholds must be non-negative")
        if self.router_balance < minimum_amount or self.router_balance < reward_left:
            return 0
        amount = self.router_balance
        self.router_balance = 0
        return amount


@dataclass
class RevenueDistributionModel:
    """Scalar Resonance model with ordinary Synthetix floors and explicit surplus."""

    strategy_count: int
    precision: int = 10**36
    duration: int = STREAM_DURATION
    weights: list[int] = field(init=False)
    strategy_index: list[int] = field(init=False)
    claimable: list[int] = field(init=False)
    alive: list[bool] = field(init=False)
    total_weight: int = 0
    revenue_index: int = 0
    received: int = 0
    donations: int = 0
    paid: int = 0
    balance: int = 0
    router_balance: int = 0
    now: int = 0
    stream_rate: int = 0
    stream_last_update: int = 0
    stream_finish: int = 0

    def __post_init__(self) -> None:
        if self.strategy_count <= 0 or self.precision <= 0 or self.duration <= 0:
            raise ValueError("invalid model dimensions")
        self.weights = [0] * self.strategy_count
        self.strategy_index = [0] * self.strategy_count
        self.claimable = [0] * self.strategy_count
        self.alive = [True] * self.strategy_count

    def notify(self, amount: int) -> None:
        if amount <= 0:
            raise ValueError("amount must be positive")
        remaining = self.left()
        if amount < remaining:
            raise ValueError("reward smaller than left")
        self.checkpoint_revenue()
        self.received += amount
        self.balance += amount
        self.stream_rate = (amount + remaining) // self.duration
        self.stream_last_update = self.now
        self.stream_finish = self.now + self.duration

    def route(self, amount: int) -> int:
        if amount < 0:
            raise ValueError("amount must be non-negative")
        self.router_balance += amount
        if self.router_balance == 0:
            raise ValueError("no revenue")
        if self.router_balance < max(self.left(), self.duration):
            return 0
        delivered = self.router_balance
        self.notify(delivered)
        self.router_balance = 0
        return delivered

    def donate(self, amount: int) -> None:
        if amount < 0:
            raise ValueError("amount must be non-negative")
        self.donations += amount
        self.balance += amount

    def advance(self, seconds: int) -> None:
        if seconds < 0:
            raise ValueError("seconds must be non-negative")
        self.now += seconds

    def checkpoint_revenue(self) -> None:
        self.revenue_index = self.reward_per_token()
        self.stream_last_update = self.last_time_reward_applicable()

    def checkpoint(self, strategy: int) -> None:
        self._require_strategy(strategy)
        self.checkpoint_revenue()
        active_weight = self.weights[strategy] if self.alive[strategy] else 0
        delta = self.revenue_index - self.strategy_index[strategy]
        self.claimable[strategy] += active_weight * delta // self.precision
        self.strategy_index[strategy] = self.revenue_index

    def set_weight(self, strategy: int, weight: int) -> None:
        self._require_strategy(strategy)
        if weight < 0:
            raise ValueError("weight must be non-negative")
        prior = self.weights[strategy]
        if not self.alive[strategy] and weight > prior:
            raise ValueError("strategy is dead")
        self.checkpoint(strategy)
        self.weights[strategy] = weight
        if self.alive[strategy]:
            self.total_weight += weight - prior

    def kill(self, strategy: int) -> None:
        self._require_strategy(strategy)
        if not self.alive[strategy]:
            raise ValueError("strategy is dead")
        self.checkpoint(strategy)
        self.alive[strategy] = False
        self.total_weight -= self.weights[strategy]

    def claim(self, strategy: int) -> int:
        self.checkpoint(strategy)
        amount = self.claimable[strategy]
        self.claimable[strategy] = 0
        self.paid += amount
        self.balance -= amount
        return amount

    def last_time_reward_applicable(self) -> int:
        return min(self.now, self.stream_finish)

    def reward_per_token(self) -> int:
        if self.total_weight == 0:
            return self.revenue_index
        applicable = self.last_time_reward_applicable()
        if applicable <= self.stream_last_update:
            return self.revenue_index
        emitted = (applicable - self.stream_last_update) * self.stream_rate
        return self.revenue_index + emitted * self.precision // self.total_weight

    def earned(self, strategy: int) -> int:
        self._require_strategy(strategy)
        active_weight = self.weights[strategy] if self.alive[strategy] else 0
        delta = self.reward_per_token() - self.strategy_index[strategy]
        return self.claimable[strategy] + active_weight * delta // self.precision

    def left(self) -> int:
        return 0 if self.now >= self.stream_finish else (self.stream_finish - self.now) * self.stream_rate

    def surplus(self) -> int:
        obligations = self.left() + sum(self.earned(index) for index in range(self.strategy_count))
        amount = self.balance - obligations
        if amount < 0:
            raise ValueError("model is insolvent")
        return amount

    def _require_strategy(self, strategy: int) -> None:
        if strategy < 0 or strategy >= self.strategy_count:
            raise ValueError("invalid strategy")


@dataclass
class RewardDistributionModel:
    """Cumulative reward index with ordinary global and account floors and no carry buckets."""

    weights: list[int]
    precision: int = 10**36
    user_index: list[int] = field(init=False)
    accrued: list[int] = field(init=False)
    total_weight: int = field(init=False)
    reward_index: int = 0
    received: int = 0

    def __post_init__(self) -> None:
        if self.precision <= 0 or any(weight < 0 for weight in self.weights):
            raise ValueError("invalid reward model")
        self.total_weight = sum(self.weights)
        self.user_index = [0] * len(self.weights)
        self.accrued = [0] * len(self.weights)

    def emit(self, amount: int) -> None:
        if amount < 0:
            raise ValueError("amount must be non-negative")
        self.received += amount
        if self.total_weight != 0:
            self.reward_index += amount * self.precision // self.total_weight

    def earned(self, user: int) -> int:
        return self.accrued[user] + self.weights[user] * (self.reward_index - self.user_index[user]) // self.precision

    def checkpoint(self, user: int) -> None:
        self.accrued[user] = self.earned(user)
        self.user_index[user] = self.reward_index

    def set_weight(self, user: int, weight: int) -> None:
        if weight < 0:
            raise ValueError("weight must be non-negative")
        self.checkpoint(user)
        prior = self.weights[user]
        self.weights[user] = weight
        self.total_weight += weight - prior

    def surplus(self) -> int:
        return self.received - sum(self.earned(user) for user in range(len(self.weights)))
