import pytest

from python.economic_model import (
    classify_strategy_payments,
    compute,
    mining_price,
    mining_rate_at,
    split,
    synchronized_mining_emission,
)


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


def test_time_boundaries_empty_market_and_tail() -> None:
    period = 69 * 24 * 3_600
    assert [
        mining_rate_at(period - 1),
        mining_rate_at(period),
        mining_rate_at(2 * period - 1),
        mining_rate_at(2 * period),
        mining_rate_at(6 * period - 1),
        mining_rate_at(6 * period),
        mining_rate_at(1_000 * period),
    ] == [
        64 * 10**18,
        32 * 10**18,
        32 * 10**18,
        16 * 10**18,
        2 * 10**18,
        10**18,
        10**18,
    ]

    empty = compute()["mining"]["timeBasedSchedule"]["emptyMarketAtFirstBoundary"]
    assert empty == {
        "elapsedSinceStart": period,
        "totalMined": 0,
        "pendingEmission": 0,
        "globalTps": 32 * 10**18,
    }

    boundaries = compute()["mining"]["timeBasedSchedule"]["boundaryRates"]
    assert [point["globalTps"] for point in boundaries] == [
        64 * 10**18,
        32 * 10**18,
        16 * 10**18,
        8 * 10**18,
        4 * 10**18,
        2 * 10**18,
        10**18,
    ]


def test_synchronized_supply_is_explicit_and_exact() -> None:
    period = 69 * 24 * 3_600
    suite = compute()
    synchronized = suite["mining"]["synchronizedSupply"]
    assert suite["schemaVersion"] == 13
    assert synchronized["referenceCase"] == "synchronized-full-refresh-no-burn"
    assert synchronized["modelAssumption"] == (
        "Synchronized full-refresh, no-burn reference: all sixteen slots are occupied from deployment, "
        "all sixteen refresh to the prospective rate at every boundary, and all accrued emission is settled. "
        "Actual tenure-locked issuance depends on slot occupancy and turnover; this is neither a supply cap nor a forecast."
    )
    assert synchronized["tailBoundaryCount"] == 6
    assert synchronized["tailStartsAtSeconds"] == 6 * period == 35_769_600
    assert synchronized_mining_emission(6 * period) == 751_161_600 * 10**18
    assert synchronized["grossSupplyAtTail"] == 771_161_600 * 10**18
    assert synchronized["minedBpsOfGrossSupplyAtTail"] == 9_740
    assert synchronized["annualTailInflationPpmAtTail"] == 40_894
    assert [
        (point["boundaryIndex"], point["globalTps"], point["grossSupply"])
        for point in synchronized["boundaryPoints"]
    ] == [
        (0, 64 * 10**18, 20_000_000 * 10**18),
        (1, 32 * 10**18, 401_542_400 * 10**18),
        (2, 16 * 10**18, 592_313_600 * 10**18),
        (3, 8 * 10**18, 687_699_200 * 10**18),
        (4, 4 * 10**18, 735_392_000 * 10**18),
        (5, 2 * 10**18, 759_238_400 * 10**18),
        (6, 10**18, 771_161_600 * 10**18),
    ]
    assert {point["years"]: point["grossSupply"] for point in synchronized["horizonPoints"]} == {
        1: 762_694_400 * 10**18,
        3: 830_000_000 * 10**18,
        5: 893_072_000 * 10**18,
        10: 1_050_752_000 * 10**18,
        40: 1_996_832_000 * 10**18,
    }
    assert {
        point["yearsAfterTail"]: (
            point["grossSupply"],
            point["annualTailInflationPpm"],
        )
        for point in synchronized["tailRelativeHorizonPoints"]
    } == {
        1: (802_697_600 * 10**18, 39_287),
        2: (834_233_600 * 10**18, 37_802),
        5: (928_841_600 * 10**18, 33_951),
        10: (1_086_521_600 * 10**18, 29_024),
    }


def test_sixteen_equal_slot_rates_reconstruct_global_tps() -> None:
    filled = compute()["mining"]["allSlotsBeforeHalving"]
    assert filled["slotCount"] == 16
    assert len(filled["assignedRatesPerHour"]) == 16
    assert filled["assignedRatesPerHour"][0] == 64 * 10**18 * 3_600 // 16
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
