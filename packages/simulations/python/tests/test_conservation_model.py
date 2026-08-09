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
        model.notify(amount)
        if amount % 5 == 0:
            model.checkpoint(0)
        if amount % 7 == 0:
            model.checkpoint(1)
        if amount == 41:
            model.kill(1)
        assert model.classified_scaled() == model.accounted * model.precision
    model.set_weight(0, 0)
    model.set_weight(1, 0)
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
