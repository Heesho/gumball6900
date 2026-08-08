import json
from pathlib import Path

import pytest

from python.reference_model import (
    ABS_MAX_AUCTION_INIT_PRICE,
    ABS_MIN_AUCTION_INIT_PRICE,
    GENESIS_TOTAL_SUPPLY,
    INITIAL_DAILY_SCHEDULED_EMISSION,
    MAX_CUMULATIVE_MINT,
    MINING_EMISSION_ALLOCATION,
    WAD,
    advance_scheduled_emission,
    auction_price_at,
    compute_reference_results,
    derive_initial_daily_scheduled_emission,
    emission_daily_digest,
    emission_schedule_lifetime,
    mul_div,
    mul_div_up,
    normalize_raw_token_amount,
    next_auction_init_price,
    quote_mining_epoch,
    simulate_all_nonempty_emissions,
    split_acquired_asset,
    update_reward_index,
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
    result = simulate_all_nonempty_emissions(36_500)
    assert result["total_cumulative_minted"] <= MAX_CUMULATIVE_MINT
    assert GENESIS_TOTAL_SUPPLY == tokens(20_000_000)
    assert MINING_EMISSION_ALLOCATION == tokens(980_000_000)
    assert derive_initial_daily_scheduled_emission() == 465_152_749_681_042_811_702_004
    assert INITIAL_DAILY_SCHEDULED_EMISSION == derive_initial_daily_scheduled_emission()
    assert advance_scheduled_emission(INITIAL_DAILY_SCHEDULED_EMISSION) < INITIAL_DAILY_SCHEDULED_EMISSION
    assert emission_daily_digest(36_500).startswith("0x")
    assert len(emission_daily_digest(36_500)) == 66


def test_nonempty_epochs_do_not_scale_with_demand_and_empty_epochs_forfeit() -> None:
    common = {
        "scheduled_emission": tokens(100),
        "cumulative_minted": GENESIS_TOTAL_SUPPLY,
    }
    large = quote_mining_epoch(**common, total_contributed_raw=usdg(250))
    one_atom = quote_mining_epoch(**common, total_contributed_raw=1)
    empty = quote_mining_epoch(**common, total_contributed_raw=0)

    assert large["actual_emission"] == tokens(100)
    assert one_atom["actual_emission"] == large["actual_emission"]
    assert empty["actual_emission"] == 0
    assert empty["forfeited_emission"] == tokens(100)


def test_sequential_floor_lifetime_matches_reviewed_constants() -> None:
    lifetime = emission_schedule_lifetime()
    assert lifetime["positive_epochs"] == 99_884
    assert lifetime["sequential_scheduled_total"] == 979_999_999_999_999_181_815_005_172
    assert lifetime["nominal_allocation_residual"] == 818_184_994_828
    assert emission_daily_digest(36_500) == "0x22aef4fca7057d13da902b2bd05d3fd4b3bca71cb0e4c3ca4c35a1898f2a41db"


def test_six_decimal_usdg_quote_normalization() -> None:
    assert normalize_raw_token_amount(10**6, 6) == WAD


def test_auction_and_reward_rounding() -> None:
    assert auction_price_at(100, 0, 6) == 100
    assert auction_price_at(100, 1, 6) == 84
    assert auction_price_at(100, 5, 6) == 17
    assert auction_price_at(100, 6, 6) == 0
    assert auction_price_at(100, 7, 6) == 0
    assert next_auction_init_price(0, 2 * WAD, ABS_MIN_AUCTION_INIT_PRICE) == ABS_MIN_AUCTION_INIT_PRICE
    assert next_auction_init_price(ABS_MAX_AUCTION_INIT_PRICE, 3 * WAD, 1) == ABS_MAX_AUCTION_INIT_PRICE
    split = split_acquired_asset(tokens(42), True)
    # The signal-reward share launches at 10%, so 42 tokens split 37.8 / 4.2.
    assert split["manager_amount"] == 4_200_000_000_000_000_000
    assert split["vault_amount"] + split["manager_amount"] == tokens(42)

    update = update_reward_index(10, 3, 10)
    assert update["reward_per_weight_increment"] == 33
    assert update["indexed_reward"] == 9
    assert update["residue"] == 1

    reward_per_weight_stored = 0
    for _ in range(3):
        update = update_reward_index(1, 3, 10)
        reward_per_weight_stored += update["reward_per_weight_increment"]
        assert update["residue"] == 1
    assert reward_per_weight_stored == 9


def test_python_results_match_committed_fixture() -> None:
    with (PACKAGE_ROOT / "scenarios" / "reference-cases.json").open(encoding="utf-8") as scenario_file:
        scenarios = json.load(scenario_file)
    with (PACKAGE_ROOT / "fixtures" / "reference-results.json").open(encoding="utf-8") as fixture_file:
        fixture = json.load(fixture_file)

    assert compute_reference_results(scenarios) == fixture
