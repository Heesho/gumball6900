from python.economic_model import classify_strategy_payments, compute, mining_price, split


def test_hourly_price_and_payment_split() -> None:
    assert mining_price(2_000_000, 1_800) == 1_000_000
    assert mining_price(2_000_000, 3_600) == 0
    assert split(1_000_000, True) == {
        "payment": 1_000_000,
        "previousMiner": 800_000,
        "resonance": 200_000,
    }


def test_capacity_expansion_does_not_dilute_incumbent() -> None:
    capacity = compute()["mining"]["capacityExpansion"]
    assert capacity["incumbentRateAfterExpansionPerHour"] == capacity["incumbentRatePerHour"]
    assert capacity["aggregateOneHourEmission"] > capacity["undividedGlobalRatePerHour"]


def test_sequential_expansion_quantifies_the_max_capacity_transition() -> None:
    expansion = compute()["mining"]["sequentialExpansionToCap"]
    assert expansion["capacity"] == 16
    assert len(expansion["assignedRatesPerHour"]) == 16
    assert expansion["assignedRatesPerHour"][0] == 100 * 10**18
    assert expansion["assignedRatesPerHour"][-1] == 100 * 10**18 // 16
    assert expansion["aggregateBpsOfUndividedRate"] == 33_807


def test_strategy_payment_split_is_frequency_independent() -> None:
    tiny = classify_strategy_payments([1] * 10)
    combined = classify_strategy_payments([10])
    assert tiny["fundLiability"] == combined["fundLiability"] == 9
    assert tiny["bribeLiability"] == combined["bribeLiability"] == 1
    assert tiny["splitRemainder"] == combined["splitRemainder"] == 0


def test_redemption_and_supply_accounting() -> None:
    suite = compute()
    redemption = suite["redemption"]
    assert redemption["denominatorAfterCheckpoint"] == (
        redemption["supplyBeforeCheckpoint"] + redemption["pendingMining"]
    )
    supply = suite["supply"]
    assert supply["maximumSupply"] is None
    assert supply["totalSupply"] == supply["lifetimeMinted"] - supply["lifetimeBurned"]
