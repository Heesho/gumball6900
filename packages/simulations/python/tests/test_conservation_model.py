import pytest

from python.conservation_model import (
    RevenueDistributionModel,
    RewardDistributionModel,
    StrategyPaymentModel,
    synthetix_stream_emission,
)


def test_strategy_split_pays_fund_inline_and_accepts_per_purchase_flooring() -> None:
    partitioned = StrategyPaymentModel()
    for _ in range(10):
        partitioned.buy(1)
    assert partitioned.fund_received == 10
    assert partitioned.router_balance == 0

    combined = StrategyPaymentModel()
    assert combined.buy(10) == (9, 1)


def test_strategy_router_buffers_rewards_and_includes_donations() -> None:
    model = StrategyPaymentModel()
    model.buy(10_000_000)
    model.donate_to_router(7)
    assert model.fund_received == 9_000_000
    assert model.distribute(1_000_008, 0) == 0
    assert model.distribute(604_800, 0) == 1_000_007


def test_strategy_rate_changes_are_prospective_and_bounded() -> None:
    model = StrategyPaymentModel()
    for payment, rate in zip([7, 13, 19, 23], [1_000, 0, 500, 2_000], strict=True):
        model.set_bribe_bps(rate)
        model.buy(payment)
    assert model.router_balance == 4
    assert model.fund_received == 58
    with pytest.raises(ValueError, match="outside protocol bounds"):
        model.set_bribe_bps(2_001)


def test_resonance_rolls_ordinary_leftover() -> None:
    model = RevenueDistributionModel(1)
    model.set_weight(0, 1)
    model.notify(1_209_600)
    model.advance(86_400)
    assert model.left() == 1_036_800
    model.notify(1_036_800)
    assert model.earned(0) == 172_800
    assert model.left() == 1_814_400


def test_router_threshold_and_rate_division_surplus() -> None:
    model = RevenueDistributionModel(1)
    assert model.route(604_799) == 0
    assert model.route(2) == 604_801
    assert model.stream_rate == 1
    assert model.surplus() == 1
    assert synthetix_stream_emission(604_801, 604_800, 604_800) == 604_800


def test_zero_supply_and_donations_are_surplus() -> None:
    model = RevenueDistributionModel(1)
    model.notify(1_209_600)
    model.advance(3)
    model.checkpoint_revenue()
    assert model.surplus() == 6
    model.set_weight(0, 1)
    model.advance(1)
    assert model.earned(0) == 2
    model.donate(5)
    assert model.surplus() == 11


def test_kill_checkpoints_old_weight_and_excludes_later_rewards() -> None:
    model = RevenueDistributionModel(1)
    model.set_weight(0, 5)
    model.notify(604_800)
    model.advance(10)
    model.kill(0)
    assert model.claimable[0] == 10
    model.advance(10)
    assert model.earned(0) == 10
    assert model.claim(0) == 10
    model.set_weight(0, 0)
    with pytest.raises(ValueError, match="strategy is dead"):
        model.set_weight(0, 1)


def test_bribe_precision_distributes_six_decimal_rewards() -> None:
    wad = 10**18
    model = RewardDistributionModel([3_000_000 * wad, 2_000_000 * wad])
    model.emit(1_000_000)
    assert model.earned(0) == 600_000
    assert model.earned(1) == 400_000
    assert model.surplus() == 0


def test_bribe_floors_remain_surplus_without_carry() -> None:
    model = RewardDistributionModel([3, 7], precision=10)
    model.emit(1)
    assert model.earned(0) == model.earned(1) == 0
    assert model.surplus() == 1
    model.set_weight(0, 0)
    model.emit(10)
    assert model.earned(1) == 10
    assert model.surplus() == 1
