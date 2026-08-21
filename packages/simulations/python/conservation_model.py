"""Independent integer models for Resonance reward surplus and exact Bribe accounting."""

from dataclasses import dataclass, field


STREAM_DURATION = 7 * 24 * 60 * 60
SETTLEMENT_BPS = 10_000
DEFAULT_SETTLEMENT_BRIBE_BPS = 1_000
MAX_SETTLEMENT_BRIBE_BPS = 2_000


def exact_stream_emission(amount: int, duration: int, elapsed: int) -> int:
    if amount < 0 or elapsed < 0 or duration <= 0:
        raise ValueError("invalid stream input")
    active = min(elapsed, duration)
    return active * (amount // duration) + min(active, amount % duration)


@dataclass
class StrategyPaymentConservationModel:
    """Independent state model for mutable-rate cumulative classification and isolated settlement."""

    bribe_bps: int = DEFAULT_SETTLEMENT_BRIBE_BPS
    fund_liability: int = 0
    bribe_liability: int = 0
    split_remainder: int = 0
    accounted_balance: int = 0
    balance: int = 0

    def set_bribe_bps(self, new_bribe_bps: int) -> None:
        if new_bribe_bps < 0 or new_bribe_bps > MAX_SETTLEMENT_BRIBE_BPS:
            raise ValueError("bribe basis points outside protocol bounds")
        self.bribe_bps = new_bribe_bps

    def route(self, payment: int) -> None:
        if payment <= 0:
            raise ValueError("payment must be positive")
        base_bribe, raw_remainder = divmod(payment * self.bribe_bps, SETTLEMENT_BPS)
        carry, self.split_remainder = divmod(self.split_remainder + raw_remainder, SETTLEMENT_BPS)
        bribe = base_bribe + carry
        self.fund_liability += payment - bribe
        self.bribe_liability += bribe
        self.accounted_balance += payment
        self.balance += payment

    def donate(self, amount: int) -> None:
        if amount < 0:
            raise ValueError("amount must be non-negative")
        self.balance += amount

    def pay_fund(self) -> int:
        amount = self.fund_liability
        self.fund_liability = 0
        self.accounted_balance -= amount
        self.balance -= amount
        return amount

    def notify_bribe(self) -> int:
        amount = self.bribe_liability
        self.bribe_liability = 0
        self.accounted_balance -= amount
        self.balance -= amount
        return amount

    def surplus(self) -> int:
        return self.balance - self.accounted_balance


@dataclass
class RevenueConservationModel:
    """Bribe-shaped Resonance model with explicit unallocated-balance surplus."""

    strategy_count: int
    precision: int = 10**36
    weights: list[int] = field(init=False)
    strategy_index: list[int] = field(init=False)
    claimable: list[int] = field(init=False)
    alive: list[bool] = field(init=False)
    total_weight: int = 0
    revenue_index: int = 0
    accounted: int = 0
    donations: int = 0
    paid: int = 0
    balance: int = 0
    router_balance: int = 0
    now: int = 0
    stream_rate: int = 0
    stream_remainder_finish: int = 0
    stream_last_update: int = 0
    stream_finish: int = 0

    def __post_init__(self) -> None:
        if self.strategy_count <= 0 or self.precision <= 0:
            raise ValueError("invalid model dimensions")
        self.weights = [0] * self.strategy_count
        self.strategy_index = [0] * self.strategy_count
        self.claimable = [0] * self.strategy_count
        self.alive = [True] * self.strategy_count

    def notify(self, amount: int) -> None:
        """Model an exact Router pull and qualifying live-period reset."""
        if amount <= 0:
            raise ValueError("amount must be positive")

        remaining = self.left()
        if amount < remaining:
            raise ValueError("reward smaller than left")

        self.checkpoint_revenue()
        self.accounted += amount
        self.balance += amount
        self._start_stream(amount + remaining)

    def route(self, amount: int) -> int:
        """Add Router revenue and route its complete balance once it qualifies."""
        if amount < 0:
            raise ValueError("amount must be non-negative")
        self.router_balance += amount
        if self.router_balance == 0:
            raise ValueError("no revenue")
        if self.router_balance < self.left():
            return 0

        delivered = self.router_balance
        self.notify(delivered)
        self.router_balance = 0
        return delivered

    def donate(self, amount: int) -> None:
        """Model a direct USDG transfer that is never scheduled by Resonance."""
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
        emitted = self._emission_between(self.stream_last_update, applicable)
        return self.revenue_index + emitted * self.precision // self.total_weight

    def earned(self, strategy: int) -> int:
        self._require_strategy(strategy)
        active_weight = self.weights[strategy] if self.alive[strategy] else 0
        delta = self.reward_per_token() - self.strategy_index[strategy]
        return self.claimable[strategy] + active_weight * delta // self.precision

    def left(self) -> int:
        """Return exact raw reward units not yet emitted by the active period."""
        if self.now >= self.stream_finish:
            return 0
        return self._emission_between(self.now, self.stream_finish)

    def surplus(self) -> int:
        """Return balance outside the active schedule and whole Strategy entitlements."""
        obligations = self.left() + sum(self.earned(index) for index in range(self.strategy_count))
        amount = self.balance - obligations
        if amount < 0:
            raise ValueError("model is insolvent")
        return amount

    def _start_stream(self, amount: int) -> None:
        self.stream_rate, rate_remainder = divmod(amount, STREAM_DURATION)
        self.stream_remainder_finish = self.now + rate_remainder
        self.stream_last_update = self.now
        self.stream_finish = self.now + STREAM_DURATION

    def _emission_between(self, start: int, end: int) -> int:
        if end <= start:
            return 0
        amount = (end - start) * self.stream_rate
        if start < self.stream_remainder_finish:
            amount += min(end, self.stream_remainder_finish) - start
        return amount

    def _require_strategy(self, strategy: int) -> None:
        if strategy < 0 or strategy >= self.strategy_count:
            raise ValueError("invalid strategy")


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
