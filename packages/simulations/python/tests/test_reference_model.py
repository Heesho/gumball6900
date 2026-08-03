import json
from pathlib import Path

import pytest

from python.reference_model import (
    AUCTION_DURATION_SECONDS,
    GENESIS_TOTAL_SUPPLY,
    INITIAL_DAILY_SCHEDULED_EMISSION,
    MAX_CUMULATIVE_MINT,
    WAD,
    advance_scheduled_emission,
    auction_rate_at,
    compute_reference_results,
    emission_daily_digest,
    mul_div,
    mul_div_up,
    normalize_raw_token_amount,
    quote_auction_target_amount,
    quote_genesis,
    quote_mining_epoch,
    required_sponsor_usdg,
    simulate_fully_funded_emissions,
    split_acquired_asset,
    update_reference_mining_price,
    update_reward_accumulator,
)

PACKAGE_ROOT = Path(__file__).resolve().parents[2]


def tokens(whole_tokens: int) -> int:
    return whole_tokens * WAD


def usdg(whole_tokens: int) -> int:
    return whole_tokens * 10**6


def test_integer_rounding() -> None:
    assert mul_div(10, 10, 6) == 16
    assert mul_div_up(10, 10, 6) == 17
    with pytest.raises(ValueError):
        mul_div(-1, 1, 1)


def test_long_horizon_supply_respects_cap() -> None:
    result = simulate_fully_funded_emissions(36_500)
    assert result["total_cumulative_minted"] <= MAX_CUMULATIVE_MINT
    assert advance_scheduled_emission(INITIAL_DAILY_SCHEDULED_EMISSION) < INITIAL_DAILY_SCHEDULED_EMISSION
    assert emission_daily_digest(36_500).startswith("0x")
    assert len(emission_daily_digest(36_500)) == 66


def test_mining_demand_scaling_and_empty_reference_decay() -> None:
    common = {
        "scheduled_emission": tokens(100),
        "cumulative_minted": GENESIS_TOTAL_SUPPLY,
        "reference_mining_price": 2 * WAD,
    }
    full = quote_mining_epoch(**common, total_usdg_raw=usdg(250), usd_g_decimals=6)
    partial = quote_mining_epoch(**common, total_usdg_raw=usdg(95), usd_g_decimals=6)
    empty = quote_mining_epoch(**common, total_usdg_raw=0, usd_g_decimals=6)

    assert full["actual_emission"] == tokens(100)
    assert full["fully_funded"] is True
    assert partial["actual_emission"] == tokens(50)
    assert partial["fully_funded"] is False
    assert empty["actual_emission"] == 0
    assert empty["next_reference_mining_price"] == 19 * WAD // 10


def test_reference_ema_floors_each_solidity_term_independently() -> None:
    assert update_reference_mining_price(101, 104, True) == 100


def test_long_empty_tail_keeps_a_nonzero_atomic_reserve() -> None:
    reference = WAD
    for _ in range(2_000):
        reference = update_reference_mining_price(reference, 0, False)
    assert reference == 1


def test_genesis_rounds_sponsor_backing_up() -> None:
    assert required_sponsor_usdg(1) == 1
    assert required_sponsor_usdg(5) == 2
    quote = quote_genesis(usdg(80_000_000), 6)
    assert quote["required_sponsor_usdg_raw"] == usdg(20_000_000)
    assert quote["genesis_price_wad"] == WAD
    assert quote["backing_per_gbx_wad"] == WAD


def test_six_decimal_usdg_quote_normalization() -> None:
    assert normalize_raw_token_amount(10**6, 6) == WAD
    assert quote_auction_target_amount(10**6, WAD, 6, 18) == WAD


def test_auction_and_reward_rounding() -> None:
    assert auction_rate_at(WAD, 0) == 125 * WAD // 100
    assert auction_rate_at(WAD, AUCTION_DURATION_SECONDS) == 80 * WAD // 100
    split = split_acquired_asset(tokens(42), True)
    assert split["manager_amount"] == 840_000_000_000_000_000
    assert split["vault_amount"] + split["manager_amount"] == tokens(42)

    update = update_reward_accumulator(10, 3, 0, 10)
    assert update["reward_per_weight_increment"] == 33
    assert update["next_remainder"] == 1

    reward_per_weight_stored = 0
    remainder = 0
    for _ in range(3):
        update = update_reward_accumulator(1, 3, remainder, 10)
        reward_per_weight_stored += update["reward_per_weight_increment"]
        remainder = update["next_remainder"]
    assert reward_per_weight_stored == 10
    assert remainder == 0


def test_python_results_match_committed_fixture() -> None:
    with (PACKAGE_ROOT / "scenarios" / "reference-cases.json").open(encoding="utf-8") as scenario_file:
        scenarios = json.load(scenario_file)
    with (PACKAGE_ROOT / "fixtures" / "reference-results.json").open(encoding="utf-8") as fixture_file:
        fixture = json.load(fixture_file)

    assert compute_reference_results(scenarios) == fixture
