import pytest

from python.conservation_model import (
    RevenueConservationModel,
    RewardConservationModel,
    StrategyPaymentConservationModel,
    exact_stream_emission,
)


def test_strategy_payment_classification_conserves_and_isolates_donations() -> None:
    model = StrategyPaymentConservationModel()
    for _ in range(10_000):
        model.route(1)
    model.donate(7)
    assert model.fund_liability == 9_000
    assert model.bribe_liability == 1_000
    assert model.split_remainder == 0
    assert model.accounted_balance == model.fund_liability + model.bribe_liability
    assert model.surplus() == 7
    assert model.notify_bribe() == 1_000
    assert model.pay_fund() == 9_000
    assert model.balance == 7
    assert model.accounted_balance == 0


def test_qualifying_live_top_up_checkpoints_and_restarts_with_reward_plus_left() -> None:
    model = RevenueConservationModel(1)
    model.set_weight(0, 1)
    model.notify(1_209_600)
    first_finish = model.stream_finish

    model.advance(86_400)
    assert model.left() == 1_036_800
    model.notify(1_036_800)

    assert model.earned(0) == 172_800
    assert model.left() == 2_073_600
    assert model.stream_finish == 86_400 + 604_800
    assert model.stream_finish > first_finish
    assert model.surplus() == 0


def test_subthreshold_notification_rejects_and_router_holds_until_qualifying() -> None:
    model = RevenueConservationModel(1)
    model.set_weight(0, 1)
    assert model.route(1_209_600) == 1_209_600
    first_finish = model.stream_finish

    model.advance(86_400)
    minimum = model.left()
    with pytest.raises(ValueError, match="reward smaller than left"):
        model.notify(minimum - 1)
    assert model.stream_finish == first_finish

    assert model.route(700_000) == 0
    assert model.router_balance == 700_000
    assert model.stream_finish == first_finish

    assert model.route(minimum - 700_000) == minimum
    assert model.router_balance == 0
    assert model.left() == 2 * minimum


def test_one_raw_unit_is_front_loaded_into_the_first_second() -> None:
    model = RevenueConservationModel(1)
    model.set_weight(0, 1)
    model.notify(1)

    assert model.left() == 1
    model.advance(1)
    assert model.left() == 0
    assert model.claim(0) == 1
    assert model.balance == 0

    assert exact_stream_emission(1, 604_800, 0) == 0
    assert exact_stream_emission(1, 604_800, 1) == 1


def test_zero_supply_emission_and_direct_donations_are_surplus() -> None:
    model = RevenueConservationModel(1)
    model.notify(7)
    model.advance(3)
    model.checkpoint_revenue()
    assert model.left() == 4
    assert model.surplus() == 3

    model.set_weight(0, 1)
    model.advance(1)
    assert model.earned(0) == 1
    assert model.surplus() == 3

    model.donate(5)
    assert model.donations == 5
    assert model.surplus() == 8


def test_strategy_flooring_remains_surplus_instead_of_carrying_fractions() -> None:
    model = RevenueConservationModel(2)
    model.set_weight(0, 1)
    model.set_weight(1, 1)
    model.notify(2)

    model.advance(1)
    model.checkpoint(0)
    model.checkpoint(1)
    assert model.claimable == [0, 0]
    assert model.surplus() == 1

    model.advance(1)
    model.checkpoint(0)
    model.checkpoint(1)
    assert model.claimable == [0, 0]
    assert model.surplus() == 2


def test_kill_uses_old_denominator_preserves_stored_reward_and_excludes_future_earnings() -> None:
    model = RevenueConservationModel(1)
    model.set_weight(0, 5)
    model.notify(604_800)
    model.advance(10)

    model.kill(0)
    assert model.claimable[0] == 10
    assert model.total_weight == 0
    assert model.weights[0] == 5

    model.advance(10)
    model.checkpoint_revenue()
    assert model.earned(0) == 10
    assert model.surplus() == 10
    assert model.claim(0) == 10

    model.set_weight(0, 0)
    assert model.total_weight == 0
    with pytest.raises(ValueError, match="strategy is dead"):
        model.set_weight(0, 1)


def test_repeated_tiny_bribe_rewards_are_carried_until_attributable() -> None:
    model = RewardConservationModel([3, 7], precision=10)
    for index in range(100):
        model.emit(1)
        model.checkpoint(index % 2)
        assert model.classified_scaled() == model.accounted * model.precision
    model.checkpoint(0)
    model.checkpoint(1)
    assert sum(model.liabilities) == 100
    assert model.classified_scaled() == 1_000


def test_bribe_reward_carry_moves_to_fund_before_a_new_signaler_enters() -> None:
    model = RewardConservationModel([50, 50, 0], precision=10)
    model.emit(9)
    assert model.pending_scaled == 90

    model.set_weight(2, 100)
    assert model.pending_scaled == 0
    assert model.fund_liability == 9

    model.emit(20)
    model.checkpoint(2)
    assert model.liabilities[2] == 10
    assert model.classified_scaled() == model.accounted * model.precision
