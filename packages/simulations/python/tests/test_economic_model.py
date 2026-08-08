import json
from pathlib import Path

from python.economic_model import (
    BPS,
    DAILY_DECAY_WAD,
    GENESIS_SUPPLY,
    INITIAL_DAILY_EMISSION,
    MAX_CUMULATIVE_MINT,
    MINING_EMISSION_ALLOCATION,
    USDG_UNIT,
    WAD,
    auction_price,
    compute_economic_suite,
    derive_initial_daily_emission,
    emission_schedule_lifetime,
    next_auction_init_price,
    normalize_usdg,
    reward_index_example,
    simulate_participation_pattern,
    tokens,
)

PACKAGE_ROOT = Path(__file__).resolve().parents[2]


def as_int(value: object) -> int:
    assert isinstance(value, str)
    assert value.removeprefix("-").isdigit()
    return int(value)


def test_exact_20m_genesis_and_980m_schedule() -> None:
    assert GENESIS_SUPPLY == tokens(20_000_000)
    assert MINING_EMISSION_ALLOCATION == tokens(980_000_000)
    assert DAILY_DECAY_WAD == 999_525_354_337_060_160
    assert derive_initial_daily_emission() == 465_152_749_681_042_811_702_004
    assert INITIAL_DAILY_EMISSION == derive_initial_daily_emission()
    assert emission_schedule_lifetime() == {
        "positiveEpochs": 99_884,
        "sequentialScheduledTotal": 979_999_999_999_999_181_815_005_172,
        "nominalAllocationResidual": 818_184_994_828,
    }


def test_nonempty_contribution_size_does_not_scale_emission() -> None:
    large = simulate_participation_pattern("all-nonempty-large")
    one_atom = simulate_participation_pattern("all-nonempty-one-atom")
    assert [row["recurringMinted"] for row in large["checkpoints"]] == [
        row["recurringMinted"] for row in one_atom["checkpoints"]
    ]
    assert one_atom["checkpoints"][-1]["totalUSDGAcceptedRaw"] < large["checkpoints"][-1][
        "totalUSDGAcceptedRaw"
    ]
    assert large["checkpoints"][-1]["totalCumulativeMinted"] <= MAX_CUMULATIVE_MINT


def test_empty_epochs_forfeit_without_carry() -> None:
    sporadic = simulate_participation_pattern("sporadic-nonempty")["checkpoints"][-1]
    all_non_empty = simulate_participation_pattern("all-nonempty-one-atom")["checkpoints"][-1]
    assert sporadic["emptyEpochs"] > 0
    assert sporadic["forfeitedScheduled"] > 0
    assert sporadic["recurringMinted"] < all_non_empty["recurringMinted"]
    assert sporadic["nextScheduledEmission"] == all_non_empty["nextScheduledEmission"]


def test_no_public_bootstrap_and_six_decimal_usdg() -> None:
    assert USDG_UNIT == 10**6
    assert normalize_usdg(USDG_UNIT) == WAD
    genesis = compute_economic_suite()["genesisLiquidity"]
    assert genesis["publicBootstrap"] is False
    assert genesis["constructorMintGBXRaw"] == str(tokens(20_000_000))
    assert genesis["oneSidedPositionBudgetGBXRaw"] == genesis["constructorMintGBXRaw"]
    assert genesis["unusedResidualPolicy"] == "burn"


def test_auction_engine_rounding_and_transition() -> None:
    assert auction_price(100, 0, 6) == 100
    assert auction_price(100, 1, 6) == 84
    assert auction_price(100, 5, 6) == 17
    assert auction_price(100, 6, 6) == 0
    assert auction_price(100, 7, 6) == 0
    assert next_auction_init_price(101, 1_100_000_000_000_000_000, 1) == 111
    assert next_auction_init_price(0, 2 * WAD, 1_000_000) == 1_000_000


def test_reward_index_floors_without_carry() -> None:
    result = reward_index_example(10, 3, 10)
    assert result["rewardPerWeightIncrement"] == 33
    assert result["indexedReward"] == 9
    assert result["residue"] == 1
    assert sum(reward_index_example(1, 3, 10)["rewardPerWeightIncrement"] for _ in range(3)) == 9


def test_fixture_invariants_and_burns_do_not_reopen_capacity() -> None:
    suite = compute_economic_suite()
    burn_sweep = suite["emissions"]["burnSweep"]
    for day in sorted({row["days"] for row in burn_sweep}, key=int):
        rows = [row for row in burn_sweep if row["days"] == day]
        recurring = rows[0]["recurringMinted"]
        assert all(row["recurringMinted"] == recurring for row in rows)
        for row in rows:
            assert as_int(row["currentSupply"]) + as_int(row["actualBurn"]) == (
                tokens(20_000_000) + as_int(row["recurringMinted"])
            )

    rewards = suite["managerRewards"]["rewardYieldByStrategy"]
    # Launch share is 10%, so the acquisition is ten times the reward.
    assert as_int(rewards[0]["managerReward"]) * 10 == as_int(rewards[0]["acquired"])
    assert rewards[2]["managerReward"] == "0"
    assert rewards[2]["vaultGrowth"] == rewards[2]["acquired"]


def test_python_suite_matches_generated_fixture() -> None:
    fixture_path = PACKAGE_ROOT / "fixtures" / "economic-scenarios.json"
    with fixture_path.open(encoding="utf-8") as fixture_file:
        fixture = json.load(fixture_file)
    assert compute_economic_suite() == fixture


def test_bps_constant_is_contract_compatible() -> None:
    assert BPS == 10_000
