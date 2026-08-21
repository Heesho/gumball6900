import pytest

from python.economic_model import classify_strategy_payments, compute, mining_price, split


def test_hourly_price_and_payment_split() -> None:
    assert mining_price(2_000_000, 1_800) == 1_000_000
    assert mining_price(2_000_000, 3_600) == 0
    assert split(1_000_000, True) == {
        "payment": 1_000_000,
        "previousMiner": 800_000,
        "resonance": 200_000,
    }


def test_halving_does_not_reprice_incumbent_slot() -> None:
    slots = compute()["mining"]["staggeredFixedSlots"]
    assert slots["incumbentRateAfterHalvingPerHour"] == slots["incumbentRatePerHour"]
    assert slots["newTenureRatePerHour"] < slots["incumbentRatePerHour"]


def test_sixteen_equal_slot_rates_reconstruct_global_tps() -> None:
    filled = compute()["mining"]["allSlotsBeforeHalving"]
    assert filled["slotCount"] == 16
    assert len(filled["assignedRatesPerHour"]) == 16
    assert filled["assignedRatesPerHour"][0] == 100 * 10**18 // 16
    assert filled["aggregateBpsOfGlobalRate"] == 10_000


def test_strategy_payment_split_is_frequency_independent() -> None:
    tiny = classify_strategy_payments([1] * 10)
    combined = classify_strategy_payments([10])
    assert tiny["fundLiability"] == combined["fundLiability"] == 9
    assert tiny["bribeLiability"] == combined["bribeLiability"] == 1
    assert tiny["splitRemainder"] == combined["splitRemainder"] == 0


def test_strategy_payment_split_tracks_rate_changes_with_one_weighted_carry() -> None:
    classified = classify_strategy_payments([7, 13, 19, 23], [1_000, 0, 500, 2_000])
    assert classified["fundLiability"] == 56
    assert classified["bribeLiability"] == 6
    assert classified["splitRemainder"] == 2_500

    zero = classify_strategy_payments([1, 7, 1_000_000], 0)
    assert zero["fundLiability"] == zero["totalPayment"] == 1_000_008
    assert zero["bribeLiability"] == zero["splitRemainder"] == 0

    with pytest.raises(ValueError, match="outside protocol bounds"):
        classify_strategy_payments([1], 2_001)


def test_redemption_and_supply_accounting() -> None:
    suite = compute()
    redemption = suite["redemption"]
    assert redemption["effectiveSupplyBeforeBurn"] == (
        redemption["mintedSupplyBefore"] + redemption["pendingMining"]
    )
    supply = suite["supply"]
    assert supply["maximumSupply"] is None
    assert supply["totalSupply"] == supply["lifetimeMinted"] - supply["lifetimeBurned"]
