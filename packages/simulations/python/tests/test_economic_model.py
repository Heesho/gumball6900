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
    assert suite["schemaVersion"] == 16
    assert suite["assumptions"]["constructorSupplyGBXRaw"] == 0
    assert suite["assumptions"]["genesisLiquiditySupplyGBXRaw"] == 1_000 * 10**18
    assert suite["assumptions"]["initialSupplyGBXRaw"] == 1_000 * 10**18
    assert suite["assumptions"]["genesisLpPermanentlyLocked"] is True
    assert suite["assumptions"]["externalLpUsesOrdinaryStrategySettlement"] is True
    assert suite["assumptions"]["liquiditySpecificCoreLogic"] is False
    assert synchronized["referenceCase"] == "synchronized-full-refresh-no-burn"
    assert synchronized["modelAssumption"] == (
        "Synchronized full-refresh, no-burn reference: all sixteen slots are occupied from deployment, "
        "all sixteen refresh to the prospective rate at every boundary, and all accrued emission is settled. "
        "Actual tenure-locked issuance depends on slot occupancy and turnover; this is neither a supply cap nor a forecast."
    )
    assert synchronized["tailBoundaryCount"] == 6
    assert synchronized["tailStartsAtSeconds"] == 6 * period == 35_769_600
    assert synchronized_mining_emission(6 * period) == 751_161_600 * 10**18
    assert synchronized["grossSupplyAtTail"] == 751_162_600 * 10**18
    assert synchronized["minedBpsOfGrossSupplyAtTail"] == 9_999
    assert synchronized["annualTailInflationPpmAtTail"] == 41_982
    assert [
        (point["boundaryIndex"], point["globalTps"], point["grossSupply"])
        for point in synchronized["boundaryPoints"]
    ] == [
        (0, 64 * 10**18, 1_000 * 10**18),
        (1, 32 * 10**18, 381_543_400 * 10**18),
        (2, 16 * 10**18, 572_314_600 * 10**18),
        (3, 8 * 10**18, 667_700_200 * 10**18),
        (4, 4 * 10**18, 715_393_000 * 10**18),
        (5, 2 * 10**18, 739_239_400 * 10**18),
        (6, 10**18, 751_162_600 * 10**18),
    ]
    assert {point["years"]: point["grossSupply"] for point in synchronized["horizonPoints"]} == {
        1: 742_695_400 * 10**18,
        3: 810_001_000 * 10**18,
        5: 873_073_000 * 10**18,
        10: 1_030_753_000 * 10**18,
        40: 1_976_833_000 * 10**18,
    }
    assert {
        point["yearsAfterTail"]: (
            point["grossSupply"],
            point["annualTailInflationPpm"],
        )
        for point in synchronized["tailRelativeHorizonPoints"]
    } == {
        1: (782_698_600 * 10**18, 40_291),
        2: (814_234_600 * 10**18, 38_730),
        5: (908_842_600 * 10**18, 34_699),
        10: (1_066_522_600 * 10**18, 29_568),
    }


def test_sixteen_equal_slot_rates_reconstruct_global_tps() -> None:
    filled = compute()["mining"]["allSlotsBeforeHalving"]
    assert filled["slotCount"] == 16
    assert len(filled["assignedRatesPerHour"]) == 16
    assert filled["assignedRatesPerHour"][0] == 64 * 10**18 * 3_600 // 16
    assert filled["aggregateBpsOfGlobalRate"] == 10_000


def test_strategy_payment_split_accepts_per_purchase_flooring() -> None:
    tiny = classify_strategy_payments([1] * 10)
    combined = classify_strategy_payments([10])
    assert tiny["fundAmount"] == 10
    assert tiny["bribeAmount"] == 0
    assert combined["fundAmount"] == 9
    assert combined["bribeAmount"] == 1
    assert compute()["strategyAuction"]["perPurchaseSplitCanDependOnPartitioning"] is True


def test_strategy_payment_split_applies_each_rate_without_carry() -> None:
    classified = classify_strategy_payments([7, 13, 19, 23], [1_000, 0, 500, 2_000])
    assert classified["fundAmount"] == 58
    assert classified["bribeAmount"] == 4

    zero = classify_strategy_payments([1, 7, 1_000_000], 0)
    assert zero["fundAmount"] == zero["totalPayment"] == 1_000_008
    assert zero["bribeAmount"] == 0

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
