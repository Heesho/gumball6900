"""Integer-only economic reference model independent from the TypeScript SDK."""

from __future__ import annotations

import json
import hashlib
import sys
from decimal import Decimal, ROUND_FLOOR, localcontext
from pathlib import Path
from typing import Any, Dict, List

WAD = 10**18
ACCUMULATOR_PRECISION = 10**27
BPS_DENOMINATOR = 10_000

MAX_CUMULATIVE_MINT = 1_000_000_000 * WAD
GENESIS_LIQUIDITY_ALLOCATION = 20_000_000 * WAD
GENESIS_TOTAL_SUPPLY = GENESIS_LIQUIDITY_ALLOCATION
MINING_EMISSION_ALLOCATION = MAX_CUMULATIVE_MINT - GENESIS_TOTAL_SUPPLY

DAILY_DECAY_WAD = 999_525_354_337_060_160

MIN_AUCTION_EPOCH_PERIOD = 3_600
MAX_AUCTION_EPOCH_PERIOD = 365 * 86_400
MIN_AUCTION_PRICE_MULTIPLIER = 1_100_000_000_000_000_000
MAX_AUCTION_PRICE_MULTIPLIER = 3 * WAD
ABS_MIN_AUCTION_INIT_PRICE = 1_000_000
ABS_MAX_AUCTION_INIT_PRICE = 2**192 - 1
MANAGER_REWARD_BPS = 200


def derive_initial_daily_scheduled_emission(allocation: int = MINING_EMISSION_ALLOCATION) -> int:
    """Derive floor(allocation * (1 - 2^(-1/1460))) with ample decimal precision."""
    if allocation < 0:
        raise ValueError("allocation must be non-negative")
    with localcontext() as context:
        context.prec = 100
        daily_real_decay = Decimal(2) ** (Decimal(-1) / Decimal(1460))
        derived = Decimal(allocation) * (Decimal(1) - daily_real_decay)
        return int(derived.to_integral_value(rounding=ROUND_FLOOR))


INITIAL_DAILY_SCHEDULED_EMISSION = derive_initial_daily_scheduled_emission()


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


def simulate_all_nonempty_emissions(epoch_count: int) -> Dict[str, int]:
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


def emission_schedule_lifetime() -> Dict[str, int]:
    emission = INITIAL_DAILY_SCHEDULED_EMISSION
    scheduled_total = 0
    positive_epochs = 0
    while emission != 0:
        scheduled_total += emission
        emission = advance_scheduled_emission(emission)
        positive_epochs += 1
    return {
        "positive_epochs": positive_epochs,
        "sequential_scheduled_total": scheduled_total,
        "nominal_allocation_residual": MINING_EMISSION_ALLOCATION - scheduled_total,
    }


def quote_mining_epoch(
    scheduled_emission: int,
    cumulative_minted: int,
    total_contributed_raw: int,
) -> Dict[str, Any]:
    _non_negative(scheduled_emission, "scheduled_emission")
    _non_negative(cumulative_minted, "cumulative_minted")
    _non_negative(total_contributed_raw, "total_contributed_raw")
    available = min(scheduled_emission, remaining_mint_capacity(cumulative_minted))
    non_empty = total_contributed_raw != 0
    return {
        "scheduled_emission": scheduled_emission,
        "available_emission": available,
        "actual_emission": available if non_empty else 0,
        "forfeited_emission": 0 if non_empty else scheduled_emission,
        "non_empty": non_empty,
    }


def auction_price_at(
    init_price: int,
    elapsed_seconds: int,
    epoch_period: int,
) -> int:
    _positive(init_price, "init_price")
    _non_negative(elapsed_seconds, "elapsed_seconds")
    _positive(epoch_period, "epoch_period")
    if elapsed_seconds > epoch_period:
        return 0
    return init_price - mul_div(init_price, elapsed_seconds, epoch_period)


def next_auction_init_price(
    quoted_payment_amount: int,
    price_multiplier: int,
    min_init_price: int,
) -> int:
    _non_negative(quoted_payment_amount, "quoted_payment_amount")
    _positive(price_multiplier, "price_multiplier")
    _positive(min_init_price, "min_init_price")
    return min(
        max(mul_div(quoted_payment_amount, price_multiplier, WAD), min_init_price),
        ABS_MAX_AUCTION_INIT_PRICE,
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


def update_reward_index(
    reward_amount: int,
    total_active_weight: int,
    precision: int = ACCUMULATOR_PRECISION,
) -> Dict[str, int]:
    _non_negative(reward_amount, "reward_amount")
    _positive(total_active_weight, "total_active_weight")
    _positive(precision, "precision")
    increment = mul_div(reward_amount, precision, total_active_weight)
    indexed_reward = mul_div(increment, total_active_weight, precision)
    return {
        "notified_reward": reward_amount,
        "reward_per_weight_increment": increment,
        "indexed_reward": indexed_reward,
        "residue": reward_amount - indexed_reward,
    }


def earned_strategy_reward(
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
        result = simulate_all_nonempty_emissions(days)
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
            int(scenario["totalContributedRaw"]),
        )
        mining_quotes.append(
            {
                "id": scenario["id"],
                "scheduledEmission": _decimal(quote["scheduled_emission"]),
                "availableEmission": _decimal(quote["available_emission"]),
                "actualEmission": _decimal(quote["actual_emission"]),
                "forfeitedEmission": _decimal(quote["forfeited_emission"]),
                "nonEmpty": quote["non_empty"],
            }
        )

    auction_quotes: List[Dict[str, Any]] = []
    for scenario in scenarios["auctionCases"]:
        payment_amount = auction_price_at(
            int(scenario["initPrice"]),
            int(scenario["elapsedSeconds"]),
            int(scenario["epochPeriod"]),
        )
        split = split_acquired_asset(
            int(scenario["actualTargetReceived"]), scenario["hasLiveManagerWeight"]
        )
        auction_quotes.append(
            {
                "id": scenario["id"],
                "paymentAmount": _decimal(payment_amount),
                "nextInitPrice": _decimal(
                    next_auction_init_price(
                        payment_amount,
                        int(scenario["priceMultiplier"]),
                        int(scenario["minInitPrice"]),
                    )
                ),
                "vaultAmount": _decimal(split["vault_amount"]),
                "managerAmount": _decimal(split["manager_amount"]),
            }
        )

    reward_quotes: List[Dict[str, Any]] = []
    for scenario in scenarios["rewardCases"]:
        precision = int(scenario["precision"])
        update = update_reward_index(
            int(scenario["rewardAmount"]),
            int(scenario["totalActiveWeight"]),
            precision,
        )
        reward_quotes.append(
            {
                "id": scenario["id"],
                "notifiedReward": _decimal(update["notified_reward"]),
                "rewardPerWeightIncrement": _decimal(update["reward_per_weight_increment"]),
                "indexedReward": _decimal(update["indexed_reward"]),
                "residue": _decimal(update["residue"]),
                "userEarned": _decimal(
                    earned_strategy_reward(
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
        "genesisSupply": _decimal(GENESIS_TOTAL_SUPPLY),
        "miningEmissionAllocation": _decimal(MINING_EMISSION_ALLOCATION),
        "initialDailyScheduledEmission": _decimal(INITIAL_DAILY_SCHEDULED_EMISSION),
        "emissionDaily100YearDigest": emission_daily_digest(36_500),
        "emissionScheduleLifetime": {
            "positiveEpochs": _decimal(emission_schedule_lifetime()["positive_epochs"]),
            "sequentialScheduledTotal": _decimal(
                emission_schedule_lifetime()["sequential_scheduled_total"]
            ),
            "nominalAllocationResidual": _decimal(
                emission_schedule_lifetime()["nominal_allocation_residual"]
            ),
        },
        "emissionHorizons": emission_horizons,
        "miningQuotes": mining_quotes,
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
