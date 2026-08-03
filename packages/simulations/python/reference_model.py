"""Integer-only economic reference model independent from the TypeScript SDK."""

from __future__ import annotations

import json
import hashlib
import sys
from pathlib import Path
from typing import Any, Dict, List

WAD = 10**18
ACCUMULATOR_PRECISION = 10**27
BPS_DENOMINATOR = 10_000

MAX_CUMULATIVE_MINT = 1_000_000_000 * WAD
GENESIS_MINER_ALLOCATION = 80_000_000 * WAD
GENESIS_LIQUIDITY_ALLOCATION = 20_000_000 * WAD
GENESIS_TOTAL_SUPPLY = GENESIS_MINER_ALLOCATION + GENESIS_LIQUIDITY_ALLOCATION

INITIAL_DAILY_SCHEDULED_EMISSION = 427_181_096_645_855_643_000_000
DAILY_DECAY_WAD = 999_525_354_337_060_160

MINING_REFERENCE_FLOOR_BPS = 9_500
REFERENCE_EMA_OLD_BPS = 8_000
REFERENCE_EMA_NEW_BPS = 2_000
REFERENCE_MAX_INCREASE_BPS = 15_000

AUCTION_DURATION_SECONDS = 86_400
AUCTION_START_RATE_BPS = 12_500
AUCTION_FLOOR_RATE_BPS = 8_000
MANAGER_REWARD_BPS = 200


def _non_negative(value: int, name: str) -> None:
    if value < 0:
        raise ValueError(f"{name} must be non-negative")


def _positive(value: int, name: str) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be greater than zero")


def mul_div(x: int, y: int, denominator: int) -> int:
    _non_negative(x, "x")
    _non_negative(y, "y")
    _positive(denominator, "denominator")
    return x * y // denominator


def mul_div_up(x: int, y: int, denominator: int) -> int:
    _non_negative(x, "x")
    _non_negative(y, "y")
    _positive(denominator, "denominator")
    if x == 0 or y == 0:
        return 0
    return (x * y + denominator - 1) // denominator


def normalize_raw_token_amount(amount_raw: int, decimals: int) -> int:
    _non_negative(amount_raw, "amount_raw")
    if decimals < 0 or decimals > 18:
        raise ValueError("decimals must be between zero and 18")
    return amount_raw * 10 ** (18 - decimals)


def remaining_mint_capacity(cumulative_minted: int) -> int:
    _non_negative(cumulative_minted, "cumulative_minted")
    return max(0, MAX_CUMULATIVE_MINT - cumulative_minted)


def advance_scheduled_emission(current_emission: int, elapsed_epochs: int = 1) -> int:
    _non_negative(current_emission, "current_emission")
    _non_negative(elapsed_epochs, "elapsed_epochs")
    emission = current_emission
    for _ in range(elapsed_epochs):
        emission = mul_div(emission, DAILY_DECAY_WAD, WAD)
    return emission


def simulate_fully_funded_emissions(epoch_count: int) -> Dict[str, int]:
    _non_negative(epoch_count, "epoch_count")
    current_emission = INITIAL_DAILY_SCHEDULED_EMISSION
    cumulative_minted = GENESIS_TOTAL_SUPPLY

    for _ in range(epoch_count):
        actual_emission = min(current_emission, remaining_mint_capacity(cumulative_minted))
        cumulative_minted += actual_emission
        current_emission = advance_scheduled_emission(current_emission)

    return {
        "recurring_minted": cumulative_minted - GENESIS_TOTAL_SUPPLY,
        "total_cumulative_minted": cumulative_minted,
        "next_scheduled_emission": current_emission,
    }


def emission_daily_digest(days: int) -> str:
    """Commit every daily scheduled emission from day zero through the requested horizon."""
    _non_negative(days, "days")
    digest = bytes(32)
    emission = INITIAL_DAILY_SCHEDULED_EMISSION
    for _ in range(days + 1):
        digest = hashlib.sha256(digest + emission.to_bytes(32, byteorder="big")).digest()
        emission = advance_scheduled_emission(emission)
    return "0x" + digest.hex()


def minimum_mining_price(reference_mining_price: int) -> int:
    _positive(reference_mining_price, "reference_mining_price")
    return max(1, mul_div(reference_mining_price, MINING_REFERENCE_FLOOR_BPS, BPS_DENOMINATOR))


def update_reference_mining_price(previous_reference: int, clearing_price: int, had_contributions: bool) -> int:
    _positive(previous_reference, "previous_reference")
    _non_negative(clearing_price, "clearing_price")
    lower_bound = minimum_mining_price(previous_reference)
    if not had_contributions:
        return lower_bound

    _positive(clearing_price, "clearing_price")
    # Solidity floors the two weighted terms independently. Combining the
    # numerator first can overstate the reference by one atomic unit.
    weighted_reference = mul_div(
        previous_reference, REFERENCE_EMA_OLD_BPS, BPS_DENOMINATOR
    ) + mul_div(clearing_price, REFERENCE_EMA_NEW_BPS, BPS_DENOMINATOR)
    upper_bound = mul_div(previous_reference, REFERENCE_MAX_INCREASE_BPS, BPS_DENOMINATOR)
    return min(max(weighted_reference, lower_bound), upper_bound)


def quote_mining_epoch(
    scheduled_emission: int,
    cumulative_minted: int,
    total_usdg_raw: int,
    usd_g_decimals: int,
    reference_mining_price: int,
) -> Dict[str, Any]:
    _non_negative(scheduled_emission, "scheduled_emission")
    _non_negative(cumulative_minted, "cumulative_minted")
    _non_negative(total_usdg_raw, "total_usdg_raw")
    total_usdg_wad = normalize_raw_token_amount(total_usdg_raw, usd_g_decimals)
    _positive(reference_mining_price, "reference_mining_price")

    scheduled = min(scheduled_emission, remaining_mint_capacity(cumulative_minted))
    reserve_price = minimum_mining_price(reference_mining_price)
    if total_usdg_raw == 0:
        return {
            "scheduled_emission": scheduled,
            "minimum_mining_price": reserve_price,
            "affordable_emission": 0,
            "actual_emission": 0,
            "clearing_price": 0,
            "next_reference_mining_price": update_reference_mining_price(reference_mining_price, 0, False),
            "fully_funded": False,
        }

    affordable_emission = mul_div(total_usdg_wad, WAD, reserve_price)
    actual_emission = min(scheduled, affordable_emission)
    fully_funded = scheduled > 0 and affordable_emission >= scheduled
    clearing_price = mul_div(total_usdg_wad, WAD, scheduled) if fully_funded else reserve_price
    return {
        "scheduled_emission": scheduled,
        "minimum_mining_price": reserve_price,
        "affordable_emission": affordable_emission,
        "actual_emission": actual_emission,
        "clearing_price": clearing_price,
        "next_reference_mining_price": update_reference_mining_price(
            reference_mining_price, clearing_price, True
        ),
        "fully_funded": fully_funded,
    }


def required_sponsor_usdg(community_usdg: int) -> int:
    _non_negative(community_usdg, "community_usdg")
    return mul_div_up(community_usdg, GENESIS_LIQUIDITY_ALLOCATION, GENESIS_MINER_ALLOCATION)


def quote_genesis(community_usdg_raw: int, usd_g_decimals: int) -> Dict[str, int]:
    _non_negative(community_usdg_raw, "community_usdg_raw")
    sponsor = required_sponsor_usdg(community_usdg_raw)
    total_assets = community_usdg_raw + sponsor
    community_usdg_wad = normalize_raw_token_amount(community_usdg_raw, usd_g_decimals)
    total_assets_wad = normalize_raw_token_amount(total_assets, usd_g_decimals)
    return {
        "community_usdg_raw": community_usdg_raw,
        "required_sponsor_usdg_raw": sponsor,
        "total_genesis_assets_usdg_raw": total_assets,
        "total_genesis_supply_gbx_raw": GENESIS_TOTAL_SUPPLY,
        "genesis_price_wad": mul_div(community_usdg_wad, WAD, GENESIS_MINER_ALLOCATION),
        "backing_per_gbx_wad": mul_div(total_assets_wad, WAD, GENESIS_TOTAL_SUPPLY),
    }


def estimate_genesis_claim(participant_contribution: int, total_community_usdg: int) -> int:
    _non_negative(participant_contribution, "participant_contribution")
    _positive(total_community_usdg, "total_community_usdg")
    if participant_contribution > total_community_usdg:
        raise ValueError("participant_contribution must not exceed total_community_usdg")
    return mul_div(participant_contribution, GENESIS_MINER_ALLOCATION, total_community_usdg)


def auction_rate_at(
    reference_rate: int,
    elapsed_seconds: int,
    duration_seconds: int = AUCTION_DURATION_SECONDS,
) -> int:
    _positive(reference_rate, "reference_rate")
    _non_negative(elapsed_seconds, "elapsed_seconds")
    _positive(duration_seconds, "duration_seconds")
    start_rate = mul_div(reference_rate, AUCTION_START_RATE_BPS, BPS_DENOMINATOR)
    floor_rate = mul_div(reference_rate, AUCTION_FLOOR_RATE_BPS, BPS_DENOMINATOR)
    if elapsed_seconds >= duration_seconds:
        return floor_rate
    decay = mul_div(start_rate - floor_rate, elapsed_seconds, duration_seconds)
    return start_rate - decay


def auction_rate_scale_wad(usd_g_decimals: int, target_decimals: int) -> int:
    if usd_g_decimals < 0 or usd_g_decimals > 18 or target_decimals < 0 or target_decimals > 18:
        raise ValueError("token decimals must be between zero and 18")
    usd_g_unit = 10**usd_g_decimals
    target_unit = 10**target_decimals
    return WAD // (target_unit // usd_g_unit) if target_unit >= usd_g_unit else WAD * (usd_g_unit // target_unit)


def quote_auction_target_amount(
    usdg_amount_raw: int,
    target_per_usdg_rate: int,
    usd_g_decimals: int,
    target_decimals: int,
) -> int:
    _non_negative(usdg_amount_raw, "usdg_amount_raw")
    _positive(target_per_usdg_rate, "target_per_usdg_rate")
    return mul_div_up(
        usdg_amount_raw,
        target_per_usdg_rate,
        auction_rate_scale_wad(usd_g_decimals, target_decimals),
    )


def split_acquired_asset(
    actual_target_received: int,
    has_live_manager_weight: bool,
    manager_reward_bps: int = MANAGER_REWARD_BPS,
) -> Dict[str, int]:
    _non_negative(actual_target_received, "actual_target_received")
    _non_negative(manager_reward_bps, "manager_reward_bps")
    if manager_reward_bps > BPS_DENOMINATOR:
        raise ValueError("manager_reward_bps must not exceed BPS_DENOMINATOR")
    manager_amount = (
        mul_div(actual_target_received, manager_reward_bps, BPS_DENOMINATOR)
        if has_live_manager_weight
        else 0
    )
    return {
        "vault_amount": actual_target_received - manager_amount,
        "manager_amount": manager_amount,
    }


def update_reward_accumulator(
    reward_amount: int,
    total_active_weight: int,
    prior_remainder: int = 0,
    precision: int = ACCUMULATOR_PRECISION,
) -> Dict[str, int]:
    _non_negative(reward_amount, "reward_amount")
    _positive(total_active_weight, "total_active_weight")
    _non_negative(prior_remainder, "prior_remainder")
    _positive(precision, "precision")
    increment = mul_div(reward_amount, precision, total_active_weight)
    combined_remainder = (reward_amount * precision) % total_active_weight + prior_remainder
    increment += combined_remainder // total_active_weight
    represented = mul_div(increment, total_active_weight, precision)
    return {
        "distributable_reward": reward_amount,
        "reward_per_weight_increment": increment,
        "represented_reward": represented,
        # Scaled numerator carry, denominated modulo total_active_weight.
        "next_remainder": combined_remainder % total_active_weight,
    }


def earned_manager_reward(
    active_weight: int,
    reward_per_weight_stored: int,
    user_reward_per_weight_paid: int,
    accrued_reward: int = 0,
    precision: int = ACCUMULATOR_PRECISION,
) -> int:
    _non_negative(active_weight, "active_weight")
    _non_negative(reward_per_weight_stored, "reward_per_weight_stored")
    _non_negative(user_reward_per_weight_paid, "user_reward_per_weight_paid")
    _non_negative(accrued_reward, "accrued_reward")
    _positive(precision, "precision")
    if user_reward_per_weight_paid > reward_per_weight_stored:
        raise ValueError("user_reward_per_weight_paid must not exceed reward_per_weight_stored")
    return accrued_reward + mul_div(
        active_weight,
        reward_per_weight_stored - user_reward_per_weight_paid,
        precision,
    )


def redemption_amount(shares: int, supply_before: int, vault_balance_before: int) -> int:
    _non_negative(shares, "shares")
    _positive(supply_before, "supply_before")
    _non_negative(vault_balance_before, "vault_balance_before")
    if shares > supply_before:
        raise ValueError("shares must not exceed supply_before")
    return mul_div(vault_balance_before, shares, supply_before)


def redemption_percentage_wad(shares: int, supply_before: int) -> int:
    return redemption_amount(shares, supply_before, WAD)


def current_total_supply(cumulative_minted: int, cumulative_burned: int) -> int:
    _non_negative(cumulative_minted, "cumulative_minted")
    _non_negative(cumulative_burned, "cumulative_burned")
    if cumulative_burned > cumulative_minted:
        raise ValueError("cumulative_burned must not exceed cumulative_minted")
    return cumulative_minted - cumulative_burned


def net_supply_change(new_emission: int, gbx_burned: int) -> int:
    _non_negative(new_emission, "new_emission")
    _non_negative(gbx_burned, "gbx_burned")
    return new_emission - gbx_burned


def project_total_supply(current_supply: int, new_emission: int, gbx_burned: int) -> int:
    _non_negative(current_supply, "current_supply")
    projected = current_supply + net_supply_change(new_emission, gbx_burned)
    if projected < 0:
        raise ValueError("gbx_burned must not exceed current_supply plus new_emission")
    return projected


def _decimal(value: int) -> str:
    return str(value)


def compute_reference_results(scenarios: Dict[str, Any]) -> Dict[str, Any]:
    usd_g_decimals = int(scenarios["usdGDecimals"])
    target_decimals = int(scenarios["targetDecimals"])
    emission_horizons: List[Dict[str, Any]] = []
    for days_value in scenarios["emissionHorizonsDays"]:
        days = int(days_value)
        result = simulate_fully_funded_emissions(days)
        emission_horizons.append(
            {
                "days": days_value,
                "recurringMinted": _decimal(result["recurring_minted"]),
                "totalCumulativeMinted": _decimal(result["total_cumulative_minted"]),
                "nextScheduledEmission": _decimal(result["next_scheduled_emission"]),
            }
        )

    mining_quotes: List[Dict[str, Any]] = []
    for scenario in scenarios["miningCases"]:
        quote = quote_mining_epoch(
            int(scenario["scheduledEmission"]),
            int(scenario["cumulativeMinted"]),
            int(scenario["totalUSDGRaw"]),
            usd_g_decimals,
            int(scenario["referenceMiningPrice"]),
        )
        mining_quotes.append(
            {
                "id": scenario["id"],
                "scheduledEmission": _decimal(quote["scheduled_emission"]),
                "minimumMiningPrice": _decimal(quote["minimum_mining_price"]),
                "affordableEmission": _decimal(quote["affordable_emission"]),
                "actualEmission": _decimal(quote["actual_emission"]),
                "clearingPrice": _decimal(quote["clearing_price"]),
                "nextReferenceMiningPrice": _decimal(quote["next_reference_mining_price"]),
                "fullyFunded": quote["fully_funded"],
            }
        )

    genesis_quotes: List[Dict[str, Any]] = []
    for scenario in scenarios["genesisCases"]:
        community_usdg_raw = int(scenario["communityUSDGRaw"])
        quote = quote_genesis(community_usdg_raw, usd_g_decimals)
        genesis_quotes.append(
            {
                "id": scenario["id"],
                "communityUSDGRaw": _decimal(quote["community_usdg_raw"]),
                "requiredSponsorUSDGRaw": _decimal(quote["required_sponsor_usdg_raw"]),
                "totalGenesisAssetsUSDGRaw": _decimal(quote["total_genesis_assets_usdg_raw"]),
                "totalGenesisSupplyGBXRaw": _decimal(quote["total_genesis_supply_gbx_raw"]),
                "genesisPriceWad": _decimal(quote["genesis_price_wad"]),
                "backingPerGBXWad": _decimal(quote["backing_per_gbx_wad"]),
                "participantClaim": _decimal(
                    estimate_genesis_claim(int(scenario["participantUSDGRaw"]), community_usdg_raw)
                ),
            }
        )

    auction_quotes: List[Dict[str, Any]] = []
    for scenario in scenarios["auctionCases"]:
        rate = auction_rate_at(int(scenario["referenceRate"]), int(scenario["elapsedSeconds"]))
        split = split_acquired_asset(
            int(scenario["actualTargetReceived"]), scenario["hasLiveManagerWeight"]
        )
        auction_quotes.append(
            {
                "id": scenario["id"],
                "rate": _decimal(rate),
                "requiredTargetAmount": _decimal(
                    quote_auction_target_amount(
                        int(scenario["usdGLotRaw"]), rate, usd_g_decimals, target_decimals
                    )
                ),
                "vaultAmount": _decimal(split["vault_amount"]),
                "managerAmount": _decimal(split["manager_amount"]),
            }
        )

    reward_quotes: List[Dict[str, Any]] = []
    for scenario in scenarios["rewardCases"]:
        precision = int(scenario["precision"])
        update = update_reward_accumulator(
            int(scenario["rewardAmount"]),
            int(scenario["totalActiveWeight"]),
            int(scenario["priorRemainder"]),
            precision,
        )
        reward_quotes.append(
            {
                "id": scenario["id"],
                "distributableReward": _decimal(update["distributable_reward"]),
                "rewardPerWeightIncrement": _decimal(update["reward_per_weight_increment"]),
                "representedReward": _decimal(update["represented_reward"]),
                "nextRemainder": _decimal(update["next_remainder"]),
                "userEarned": _decimal(
                    earned_manager_reward(
                        int(scenario["userActiveWeight"]),
                        update["reward_per_weight_increment"],
                        int(scenario["userRewardPerWeightPaid"]),
                        int(scenario["userAccrued"]),
                        precision,
                    )
                ),
            }
        )

    redemption_quotes: List[Dict[str, Any]] = []
    for scenario in scenarios["redemptionCases"]:
        shares = int(scenario["shares"])
        supply_before = int(scenario["supplyBefore"])
        redemption_quotes.append(
            {
                "id": scenario["id"],
                "percentageWad": _decimal(redemption_percentage_wad(shares, supply_before)),
                "assets": [
                    {
                        "asset": asset["asset"],
                        "amount": _decimal(
                            redemption_amount(shares, supply_before, int(asset["balance"]))
                        ),
                    }
                    for asset in scenario["assets"]
                ],
            }
        )

    supply_projections: List[Dict[str, Any]] = []
    for scenario in scenarios["supplyCases"]:
        current_supply = current_total_supply(
            int(scenario["cumulativeMinted"]), int(scenario["cumulativeBurned"])
        )
        emission = int(scenario["newEmission"])
        burned = int(scenario["gbxBurned"])
        supply_projections.append(
            {
                "id": scenario["id"],
                "currentSupply": _decimal(current_supply),
                "netSupplyChange": _decimal(net_supply_change(emission, burned)),
                "projectedSupply": _decimal(project_total_supply(current_supply, emission, burned)),
            }
        )

    return {
        "schemaVersion": scenarios["schemaVersion"],
        "usdGDecimals": scenarios["usdGDecimals"],
        "targetDecimals": scenarios["targetDecimals"],
        "emissionDaily100YearDigest": emission_daily_digest(36_500),
        "emissionHorizons": emission_horizons,
        "miningQuotes": mining_quotes,
        "genesisQuotes": genesis_quotes,
        "auctionQuotes": auction_quotes,
        "rewardQuotes": reward_quotes,
        "redemptionQuotes": redemption_quotes,
        "supplyProjections": supply_projections,
    }


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: reference_model.py SCENARIO_JSON")
    scenario_path = Path(sys.argv[1])
    with scenario_path.open("r", encoding="utf-8") as scenario_file:
        scenarios = json.load(scenario_file)
    print(json.dumps(compute_reference_results(scenarios), separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    main()
