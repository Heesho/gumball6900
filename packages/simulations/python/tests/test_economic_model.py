import json
from pathlib import Path

from python.economic_model import (
    BPS,
    DAY,
    GENESIS_LP_GBX,
    MAX_CUMULATIVE_MINT,
    USDG_UNIT,
    WAD,
    auction_rate,
    compute_economic_suite,
    ladder_state,
    minimum_mining_price,
    normalize_usdg,
    quote_bootstrap,
    simulate_demand_pattern,
    tokens,
    update_reference_price,
    usd_g,
)

PACKAGE_ROOT = Path(__file__).resolve().parents[2]


def as_int(value: object) -> int:
    assert isinstance(value, str)
    assert value.removeprefix("-").isdigit()
    return int(value)


def test_six_decimal_usdg_normalization_and_bootstrap() -> None:
    assert USDG_UNIT == 10**6
    assert normalize_usdg(USDG_UNIT) == WAD
    quote = quote_bootstrap(usd_g(80_000_000))
    assert quote["sponsorRequirementUSDGRaw"] == usd_g(20_000_000)
    assert quote["initialGBXPrice"] == WAD
    assert quote["backingPerGBX"] == WAD
    assert quote["genesisRedemptionUSDGRaw"] == quote["participantContributionUSDGRaw"]


def test_long_empty_tail_and_ema_rounding_regressions() -> None:
    assert update_reference_price(101, 104, True) == 100
    reference = WAD
    for _ in range(2_000):
        reference = update_reference_price(reference, 0, False)
    assert reference == 1
    assert minimum_mining_price(reference) == 1


def test_emission_paths_respect_cap_and_demand() -> None:
    full = simulate_demand_pattern("fully-funded")
    half = simulate_demand_pattern("fifty-percent-funded")
    assert full["checkpoints"][-1]["totalCumulativeMinted"] <= MAX_CUMULATIVE_MINT
    assert half["checkpoints"][-1]["recurringMinted"] < full["checkpoints"][-1]["recurringMinted"]
    assert len(simulate_demand_pattern("long-empty-period")["checkpoints"]) == 5


def test_price_shocks_are_bounded_and_burn_sweep_conserves_supply() -> None:
    suite = compute_economic_suite()
    emissions = suite["emissions"]
    traces = emissions["priceShockTraces"]

    for trace in traces:
        points = trace["points"]
        for index, point in enumerate(points):
            previous = as_int(point["previousReferencePrice"])
            clearing = as_int(point["effectiveClearingPrice"])
            next_reference = as_int(point["nextReferencePrice"])
            assert clearing >= as_int(point["reservePrice"])
            assert clearing >= as_int(point["requestedMarketPrice"])
            assert min(previous, clearing) <= next_reference <= max(previous, clearing)
            if index > 0:
                assert point["previousReferencePrice"] == points[index - 1]["nextReferencePrice"]

    increase = next(trace for trace in traces if trace["id"] == "large-price-increase")["points"]
    assert all(
        as_int(point["previousReferencePrice"])
        < as_int(point["nextReferencePrice"])
        < as_int(point["requestedMarketPrice"])
        for point in increase
    )
    decrease = next(trace for trace in traces if trace["id"] == "large-price-decrease")["points"]
    assert all(
        as_int(point["requestedMarketPrice"])
        < as_int(point["nextReferencePrice"])
        < as_int(point["previousReferencePrice"])
        for point in decrease
    )
    lag = next(trace for trace in traces if trace["id"] == "reference-price-lag")["points"]
    assert as_int(lag[5]["nextReferencePrice"]) > as_int(lag[5]["previousReferencePrice"])
    assert as_int(lag[6]["requestedMarketPrice"]) < as_int(lag[6]["nextReferencePrice"])
    assert as_int(lag[6]["nextReferencePrice"]) < as_int(lag[6]["previousReferencePrice"])

    burn_sweep = emissions["burnSweep"]
    genesis_supply = None
    for day in sorted({row["days"] for row in burn_sweep}, key=int):
        rows = [row for row in burn_sweep if row["days"] == day]
        assert [row["burnRateBps"] for row in rows] == ["0", "5000", "10000", "12500", "15000"]
        total_minted = as_int(rows[0]["currentSupply"]) + as_int(rows[0]["actualBurn"])
        for index, row in enumerate(rows):
            requested = as_int(row["requestedBurn"])
            actual = as_int(row["actualBurn"])
            current = as_int(row["currentSupply"])
            assert current + actual == total_minted
            assert actual <= requested
            assert actual <= total_minted
            if index > 0:
                assert requested >= as_int(rows[index - 1]["requestedBurn"])
                assert actual >= as_int(rows[index - 1]["actualBurn"])
                assert current <= as_int(rows[index - 1]["currentSupply"])
            if requested >= total_minted:
                assert actual == total_minted
                assert current == 0

        full_recurring_burn = rows[2]
        assert full_recurring_burn["actualBurn"] == full_recurring_burn["recurringMinted"]
        remaining_genesis = as_int(full_recurring_burn["currentSupply"])
        genesis_supply = remaining_genesis if genesis_supply is None else genesis_supply
        assert remaining_genesis == genesis_supply


def test_human_wad_auction_rates_and_6_to_18_decimal_quote() -> None:
    assert auction_rate(WAD, 0) == 125 * WAD // 100
    midpoint_rate = auction_rate(WAD, DAY // 2)
    assert midpoint_rate == 1_025_000_000_000_000_000
    ten_thousand_usdg_raw = usd_g(10_000)
    required_target_raw = normalize_usdg(ten_thousand_usdg_raw) * midpoint_rate // WAD
    assert required_target_raw == tokens(10_250)


def test_budget_accumulation_conserves_unspent_usdg_through_missing_liquidity_and_halts() -> None:
    rows = compute_economic_suite()["auctions"]["budgetAccumulation"]
    opening_budget = 0
    total_allocated = 0
    total_spent = 0

    for expected_day, row in enumerate(rows, start=1):
        allocated = as_int(row["allocatedUSDGRaw"])
        spent = as_int(row["lotSpentUSDGRaw"])
        closing = as_int(row["closingBudgetUSDGRaw"])
        assert as_int(row["day"]) == expected_day
        assert opening_budget + allocated == closing + spent
        assert spent <= opening_budget + allocated
        if row["filled"]:
            assert row["makerAvailable"]
            assert not row["tradingHalted"]
            assert spent > 0
        else:
            assert spent == 0
        if not row["makerAvailable"] or row["tradingHalted"]:
            assert not row["filled"]
        total_allocated += allocated
        total_spent += spent
        opening_budget = closing

    assert total_allocated == total_spent + opening_budget
    assert all(not row["makerAvailable"] and not row["filled"] for row in rows[:3])
    halted = next(row for row in rows if row["tradingHalted"])
    assert not halted["filled"]


def test_one_sided_ladder_inventory() -> None:
    start = ladder_state(WAD)
    finish = ladder_state(12 * WAD)
    assert start["gbxRemaining"] == GENESIS_LP_GBX
    assert start["usdGRaisedRaw"] == 0
    assert finish["gbxRemaining"] == 0
    assert finish["usdGRaisedRaw"] > usd_g(20_000_000)


def test_reward_and_buyback_invariants_from_full_suite() -> None:
    suite = compute_economic_suite()
    active = suite["managerRewards"]["rewardYieldByStrategy"][0]
    inactive = suite["managerRewards"]["rewardYieldByStrategy"][2]
    assert int(active["managerReward"]) * 50 == int(active["acquired"])
    assert int(inactive["managerReward"]) == 0
    assert inactive["vaultGrowth"] == inactive["acquired"]

    below, above = suite["redemptionAndBuyback"]["marketRelativeToBacking"]
    assert int(below["backingPerGBXAfter"]) > int(below["backingPerGBXBefore"])
    assert int(above["backingPerGBXAfter"]) < int(above["backingPerGBXBefore"])


def test_concentration_switching_no_lock_and_reward_leakage_boundaries() -> None:
    rewards = compute_economic_suite()["managerRewards"]

    concentration = rewards["voteConcentration"]
    managers = concentration["managers"]
    total_reward = as_int(concentration["totalReward"])
    assert sum(as_int(manager["weightBps"]) for manager in managers) == BPS
    assert sum(as_int(manager["reward"]) for manager in managers) == total_reward
    for manager in managers:
        assert as_int(manager["reward"]) * BPS == total_reward * as_int(manager["weightBps"])
    assert BPS // len(managers) < as_int(concentration["hhiBps"]) < BPS

    switching = rewards["frequentSwitching"]
    assert all(
        as_int(current["hour"]) < as_int(following["hour"])
        for current, following in zip(switching, switching[1:])
    )
    delayed_fills = [
        row
        for row in switching
        if "before-activation" in row["event"] or "during-delay" in row["event"]
    ]
    assert all(row["activeStrategy"] == "none" and as_int(row["reward"]) == 0 for row in delayed_fills)
    rewarded_fills = [row for row in switching if as_int(row["reward"]) > 0]
    assert [row["activeStrategy"] for row in rewarded_fills] == ["strategy-b", "strategy-a"]
    assert as_int(rewarded_fills[0]["hour"]) - as_int(switching[0]["hour"]) >= 24
    assert as_int(rewarded_fills[1]["hour"]) - as_int(switching[3]["hour"]) >= 24

    churn = rewards["noLockStakeChurn"]
    early = churn["earlyExit"]
    post_activation = churn["postActivationExit"]
    assert as_int(early["stakedAtSecond"]) < as_int(early["unstakedAtSecond"])
    assert as_int(early["unstakedAtSecond"]) < as_int(post_activation["activatedAtSecond"])
    assert as_int(early["activeWeightAtExit"]) == 0
    assert as_int(early["rewardCaptured"]) == 0
    assert early["cancelledPendingWeight"] == post_activation["activeWeightAtFill"]
    assert post_activation["unstakedAtSecond"] == post_activation["filledAtSecond"]
    assert post_activation["unstakedAtSecond"] == post_activation["activatedAtSecond"]
    assert as_int(post_activation["accruedRewardAfterUnstake"]) > 0

    leakage = rewards["rewardLeakageVsVaultGrowth"]
    per_fill = [as_int(row["acquired"]) // as_int(row["fillCount"]) for row in leakage]
    assert len(set(per_fill)) == 1
    for row in leakage:
        acquired = as_int(row["acquired"])
        manager_reward = as_int(row["managerReward"])
        vault_growth = as_int(row["vaultGrowth"])
        assert manager_reward + vault_growth == acquired
        if manager_reward:
            assert manager_reward * 50 == acquired
            assert vault_growth * 50 == acquired * 49
            assert as_int(row["redirectedToVault"]) == 0
        else:
            assert vault_growth == acquired
            assert as_int(row["redirectedToVault"]) * 50 == acquired


def test_revenue_sources_and_simultaneous_burns_conserve_supply_and_vault_value() -> None:
    section = compute_economic_suite()["redemptionAndBuyback"]
    sources = section["revenueSourceComparison"]
    for source in sources:
        assert as_int(source["supplyAfter"]) == (
            as_int(source["startingSupply"]) + as_int(source["emission"]) - as_int(source["gbxBurned"])
        )
        assert as_int(source["vaultValueAfterUSDGRaw"]) == (
            as_int(source["startingVaultValueUSDGRaw"])
            + as_int(source["revenueUSDGRaw"])
            - as_int(source["buybackSpendUSDGRaw"])
        )
        assert as_int(source["buybackSpendUSDGRaw"]) <= as_int(source["revenueUSDGRaw"])
        assert as_int(source["gbxBurned"]) > 0

    mining = next(source for source in sources if source["id"] == "mining-revenue")
    lp_fees = next(source for source in sources if source["id"] == "lp-fee-revenue")
    assert mining["buybackSpendUSDGRaw"] == lp_fees["buybackSpendUSDGRaw"]
    assert mining["marketPrice"] == lp_fees["marketPrice"]
    assert mining["gbxBurned"] == lp_fees["gbxBurned"]
    assert as_int(mining["supplyAfter"]) > as_int(mining["startingSupply"])
    assert as_int(lp_fees["supplyAfter"]) < as_int(lp_fees["startingSupply"])
    assert as_int(mining["vaultValueAfterUSDGRaw"]) > as_int(mining["startingVaultValueUSDGRaw"])
    assert lp_fees["vaultValueAfterUSDGRaw"] == lp_fees["startingVaultValueUSDGRaw"]
    assert as_int(lp_fees["backingPerGBXAfter"]) > as_int(mining["backingPerGBXAfter"])

    simultaneous = section["simultaneousEmissionAndBurn"]
    for index, row in enumerate(simultaneous):
        net_change = as_int(row["netSupplyChange"])
        assert net_change == as_int(row["emission"]) - as_int(row["burn"])
        assert as_int(row["supplyAfter"]) == as_int(row["startingSupply"]) + net_change
        if index > 0:
            assert as_int(row["burn"]) > as_int(simultaneous[index - 1]["burn"])
            assert as_int(row["supplyAfter"]) < as_int(simultaneous[index - 1]["supplyAfter"])

    neutral = next(row for row in simultaneous if row["burnRateBps"] == str(BPS))
    net_burn = next(row for row in simultaneous if as_int(row["netSupplyChange"]) < 0)
    assert as_int(neutral["netSupplyChange"]) == 0
    assert neutral["supplyAfter"] == neutral["startingSupply"]
    assert as_int(net_burn["supplyAfter"]) < as_int(net_burn["startingSupply"])


def test_lp_sales_conserve_inventory_and_range_proceeds() -> None:
    inventory = compute_economic_suite()["redemptionAndBuyback"]["lpInventorySoldOverTime"]
    total_inventory = as_int(inventory[0]["gbxRemaining"]) + as_int(inventory[0]["gbxSold"])

    for index, row in enumerate(inventory):
        positions = row["positions"]
        assert as_int(row["gbxRemaining"]) + as_int(row["gbxSold"]) == total_inventory
        assert sum(as_int(position["gbxAllocation"]) for position in positions) == total_inventory
        assert sum(as_int(position["gbxRemaining"]) for position in positions) == as_int(row["gbxRemaining"])
        assert sum(as_int(position["usdGRaisedWad"]) for position in positions) == as_int(row["usdGRaisedWad"])
        assert sum(as_int(position["usdGRaisedRaw"]) for position in positions) == as_int(row["usdGRaisedRaw"])
        for position in positions:
            assert as_int(position["gbxRemaining"]) <= as_int(position["gbxAllocation"])
            if as_int(row["priceMultipleWad"]) <= as_int(position["lowerPriceMultipleWad"]):
                assert position["gbxRemaining"] == position["gbxAllocation"]
                assert as_int(position["usdGRaisedWad"]) == 0
            if as_int(row["priceMultipleWad"]) >= as_int(position["upperPriceMultipleWad"]):
                assert as_int(position["gbxRemaining"]) == 0
        if index > 0:
            previous = inventory[index - 1]
            assert as_int(row["priceMultipleWad"]) > as_int(previous["priceMultipleWad"])
            assert as_int(row["gbxSold"]) > as_int(previous["gbxSold"])
            assert as_int(row["gbxRemaining"]) < as_int(previous["gbxRemaining"])
            assert as_int(row["usdGRaisedRaw"]) > as_int(previous["usdGRaisedRaw"])

    assert as_int(inventory[0]["gbxSold"]) == 0
    assert as_int(inventory[0]["usdGRaisedRaw"]) == 0
    assert as_int(inventory[-1]["gbxRemaining"]) == 0
    assert as_int(inventory[-1]["gbxSold"]) == total_inventory


def test_python_suite_matches_committed_fixture() -> None:
    fixture_path = PACKAGE_ROOT / "fixtures" / "economic-scenarios.json"
    with fixture_path.open(encoding="utf-8") as fixture_file:
        fixture = json.load(fixture_file)
    assert compute_economic_suite() == fixture


def test_bps_constant_is_contract_compatible() -> None:
    assert BPS == 10_000
