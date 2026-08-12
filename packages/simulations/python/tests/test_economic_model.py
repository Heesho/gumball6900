from python.economic_model import compute, mining_price, split


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


def test_redemption_and_supply_accounting() -> None:
    suite = compute()
    redemption = suite["redemption"]
    assert redemption["denominatorAfterCheckpoint"] == (
        redemption["supplyBeforeCheckpoint"] + redemption["pendingMining"]
    )
    supply = suite["supply"]
    assert supply["maximumSupply"] is None
    assert supply["totalSupply"] == supply["lifetimeMinted"] - supply["lifetimeBurned"]
