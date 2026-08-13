from python.conservation_model import (
    RevenueConservationModel,
    RewardConservationModel,
    exact_stream_emission,
)


def test_revenue_atoms_survive_weight_churn_and_retirement() -> None:
    model = RevenueConservationModel(3, precision=10)
    model.set_weight(0, 3)
    model.set_weight(1, 7)
    for amount in range(1, 98):
        model.notify(604_800 + amount)
        model.advance(604_800)
        if amount % 5 == 0:
            model.checkpoint(0)
        if amount % 7 == 0:
            model.checkpoint(1)
        if amount == 41:
            model.kill(1)
        assert model.classified_scaled() == model.accounted * model.precision
    model.advance(604_800)
    model.checkpoint(0)
    model.checkpoint(1)
    model.set_weight(0, 0)
    model.set_weight(1, 0)
    assert model.classified_scaled() == model.accounted * model.precision


def test_live_top_up_queues_without_changing_the_active_stream() -> None:
    model = RevenueConservationModel(2)
    model.set_weight(0, model.precision)
    model.notify(1_209_600)
    assert model.stream_rate_scaled == 2 * model.precision
    first_finish = model.stream_finish

    model.advance(86_400)
    model.notify(700_000)
    assert model.queued_revenue == 700_000
    assert model.stream_finish == first_finish
    assert model.stream_rate_scaled == 2 * model.precision

    model.advance(518_400)
    model.checkpoint_revenue()
    assert model.queued_revenue == 0
    assert model.stream_remaining_scaled == 700_000 * model.precision
    assert model.stream_finish == first_finish + 604_800

    model.advance(604_800)
    model.checkpoint(0)
    assert model.claimable[0] == 1_909_600
    assert (
        model.stream_rate_scaled,
        model.stream_remaining_scaled,
        model.stream_last_update,
        model.stream_finish,
    ) == (0, 0, 0, 0)
    assert model.classified_scaled() == model.accounted * model.precision


def test_single_raw_revenue_unit_streams_without_terminal_router_dust() -> None:
    model = RevenueConservationModel(1)
    model.set_weight(0, 1)
    model.notify(1)
    model.advance(604_800)
    model.checkpoint(0)
    assert model.claimable[0] == 1
    assert model.classified_scaled() == model.precision


def test_one_queued_successor_catches_up_in_bounded_work() -> None:
    model = RevenueConservationModel(1)
    model.set_weight(0, 1)
    model.notify(100_000_000)
    model.advance(86_400)
    model.notify(10_000_000)
    model.advance(13 * 86_400)
    model.checkpoint(0)
    assert model.claimable[0] == 110_000_000
    assert model.stream_remaining_scaled == 0
    assert model.queued_revenue == 0


def test_new_signal_receives_only_post_entry_stream_time() -> None:
    model = RevenueConservationModel(2)
    model.set_weight(0, 1)
    model.notify(604_800)
    model.advance(86_400)
    model.set_weight(1, 1)
    model.advance(518_400)
    model.checkpoint(0)
    model.checkpoint(1)

    assert model.claimable == [345_600, 259_200]


def test_unindexable_old_weight_carry_moves_to_fund_before_denominator_change() -> None:
    model = RevenueConservationModel(2, precision=10)
    model.set_weight(0, 20)
    model.notify(1)
    model.advance(604_800)
    model.checkpoint_revenue()
    assert model.pending_scaled == 10

    model.set_weight(1, 1)
    assert model.pending_scaled == 0
    assert model.fund_liability == 1
    assert model.claimable == [0, 0]
    assert model.classified_scaled() == model.accounted * model.precision


def test_exact_low_decimal_stream_and_zero_supply_pause() -> None:
    duration = 604_800
    assert exact_stream_emission(1, duration, 0) == 0
    assert exact_stream_emission(1, duration, 1) == 1
    assert exact_stream_emission(7, duration, 3) == 3
    assert exact_stream_emission(7, duration, duration) == 7
    active_before_pause = 4
    active_after_resume = 5
    assert exact_stream_emission(11, duration, active_before_pause + active_after_resume) == 9


def test_repeated_tiny_rewards_are_carried_until_attributable() -> None:
    model = RewardConservationModel([3, 7], precision=10)
    for index in range(100):
        model.emit(1)
        model.checkpoint(index % 2)
        assert model.classified_scaled() == model.accounted * model.precision
    model.checkpoint(0)
    model.checkpoint(1)
    assert sum(model.liabilities) == 100
    assert model.classified_scaled() == 1_000


def test_reward_carry_moves_to_fund_before_a_new_signaler_enters() -> None:
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
