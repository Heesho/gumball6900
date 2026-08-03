"""Independent integer-only model for the master-spec section 33 scenarios."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

WAD = 10**18
BPS = 10_000
DAY = 86_400
USDG_DECIMALS = 6
USDG_UNIT = 10**USDG_DECIMALS
USDG_NORMALIZATION_SCALE = WAD // USDG_UNIT
TARGET_UNIT = WAD
# Strategy rates are human-normalized target tokens per USDG, scaled by WAD.
UNIT_TARGET_PER_USDG_RATE = WAD

MAX_CUMULATIVE_MINT = 1_000_000_000 * WAD
GENESIS_MINER_GBX = 80_000_000 * WAD
GENESIS_LP_GBX = 20_000_000 * WAD
GENESIS_SUPPLY = GENESIS_MINER_GBX + GENESIS_LP_GBX
INITIAL_DAILY_EMISSION = 427_181_096_645_855_643_000_000
DAILY_DECAY_WAD = 999_525_354_337_060_160

HORIZON_DAYS = [365, 1_460, 2_920, 5_840, 11_680]
EMISSION_BURN_BPS = [0, 5_000, 10_000, 12_500, 15_000]


def mul_div(a: int, b: int, denominator: int) -> int:
    if a < 0 or b < 0 or denominator <= 0:
        raise ValueError("mul_div requires non-negative values and a positive denominator")
    return a * b // denominator


def mul_div_up(a: int, b: int, denominator: int) -> int:
    if a < 0 or b < 0 or denominator <= 0:
        raise ValueError("mul_div_up requires non-negative values and a positive denominator")
    if a == 0 or b == 0:
        return 0
    return (a * b + denominator - 1) // denominator


def tokens(amount: int) -> int:
    return amount * WAD


def usd_g(amount: int) -> int:
    return amount * USDG_UNIT


def normalize_usdg(raw_amount: int) -> int:
    return raw_amount * USDG_NORMALIZATION_SCALE


def usdg_price_wad(raw_usdg: int, gbx_amount: int) -> int:
    return mul_div(normalize_usdg(raw_usdg), WAD, gbx_amount)


def raw_usdg_for_emission_up(gbx_amount: int, price_wad: int) -> int:
    return mul_div_up(gbx_amount, price_wad, WAD * USDG_NORMALIZATION_SCALE)


def minimum_mining_price(reference_price: int) -> int:
    if reference_price <= 0:
        raise ValueError("reference price must be positive")
    return max(mul_div(reference_price, 9_500, BPS), 1)


def update_reference_price(previous: int, clearing: int, had_contributions: bool) -> int:
    lower = minimum_mining_price(previous)
    if not had_contributions:
        return lower
    if clearing <= 0:
        raise ValueError("a contributed epoch requires a positive clearing price")
    # Solidity floors the terms independently.
    weighted = mul_div(previous, 8_000, BPS) + mul_div(clearing, 2_000, BPS)
    upper = mul_div(previous, 15_000, BPS)
    return min(max(weighted, lower), upper)


def demand_funding_bps(pattern: str, day_index: int) -> int:
    if pattern == "fully-funded":
        return BPS
    if pattern == "fifty-percent-funded":
        return 5_000
    if pattern == "sporadic-demand":
        weekly = [10_000, 0, 2_500, 0, 10_000, 5_000, 0]
        return weekly[day_index % len(weekly)]
    if pattern == "long-empty-period":
        if day_index < 365:
            return BPS
        if day_index < 2_365:
            return 0
        return BPS if day_index % 3 == 0 else 5_000
    raise ValueError(f"unknown demand pattern: {pattern}")


def simulate_demand_pattern(pattern: str) -> Dict[str, Any]:
    scheduled = INITIAL_DAILY_EMISSION
    cumulative_minted = GENESIS_SUPPLY
    reference_price = WAD
    total_usdg_accepted_raw = 0
    fully_funded_epochs = 0
    partially_funded_epochs = 0
    empty_epochs = 0
    checkpoints: List[Dict[str, Any]] = []

    for day_index in range(HORIZON_DAYS[-1]):
        epoch_scheduled = min(scheduled, MAX_CUMULATIVE_MINT - cumulative_minted)
        funding_bps = demand_funding_bps(pattern, day_index)
        desired_emission = mul_div(epoch_scheduled, funding_bps, BPS)
        reserve_price = minimum_mining_price(reference_price)
        contributed_usdg_raw = raw_usdg_for_emission_up(desired_emission, reserve_price)
        affordable_emission = (
            0
            if contributed_usdg_raw == 0
            else mul_div(normalize_usdg(contributed_usdg_raw), WAD, reserve_price)
        )
        actual_emission = min(epoch_scheduled, affordable_emission)
        fully_funded = epoch_scheduled > 0 and actual_emission == epoch_scheduled
        if contributed_usdg_raw == 0:
            clearing_price = 0
        elif fully_funded:
            clearing_price = usdg_price_wad(contributed_usdg_raw, epoch_scheduled)
        else:
            clearing_price = reserve_price

        cumulative_minted += actual_emission
        total_usdg_accepted_raw += contributed_usdg_raw
        if contributed_usdg_raw == 0:
            empty_epochs += 1
        elif fully_funded:
            fully_funded_epochs += 1
        else:
            partially_funded_epochs += 1

        reference_price = update_reference_price(reference_price, clearing_price, contributed_usdg_raw != 0)
        scheduled = mul_div(scheduled, DAILY_DECAY_WAD, WAD)

        elapsed_days = day_index + 1
        if elapsed_days in HORIZON_DAYS:
            checkpoints.append(
                {
                    "days": elapsed_days,
                    "recurringMinted": cumulative_minted - GENESIS_SUPPLY,
                    "totalCumulativeMinted": cumulative_minted,
                    "totalUSDGAcceptedRaw": total_usdg_accepted_raw,
                    "nextScheduledEmission": scheduled,
                    "nextReferenceMiningPrice": reference_price,
                    "fullyFundedEpochs": fully_funded_epochs,
                    "partiallyFundedEpochs": partially_funded_epochs,
                    "emptyEpochs": empty_epochs,
                }
            )
    return {"id": pattern, "checkpoints": checkpoints}


def price_shock_trace(identifier: str, requested_market_prices: List[int]) -> Dict[str, Any]:
    reference_price = WAD
    points: List[Dict[str, Any]] = []
    for epoch, requested_market_price in enumerate(requested_market_prices, start=1):
        previous = reference_price
        reserve = minimum_mining_price(previous)
        effective = max(requested_market_price, reserve)
        reference_price = update_reference_price(previous, effective, True)
        points.append(
            {
                "epoch": epoch,
                "requestedMarketPrice": requested_market_price,
                "reservePrice": reserve,
                "effectiveClearingPrice": effective,
                "previousReferencePrice": previous,
                "nextReferencePrice": reference_price,
            }
        )
    return {"id": identifier, "points": points}


def integer_square_root(value: int) -> int:
    if value < 0:
        raise ValueError("square root value must be non-negative")
    if value < 2:
        return value
    estimate = 1 << ((value.bit_length() + 1) // 2)
    while True:
        following = (estimate + value // estimate) // 2
        if following >= estimate:
            return estimate
        estimate = following


def sqrt_wad(value_wad: int) -> int:
    return integer_square_root(value_wad * WAD)


def inverse_sqrt_wad(value_wad: int) -> int:
    return WAD * WAD // sqrt_wad(value_wad)


LADDER = [
    {"allocation": tokens(10_000_000), "lower": WAD, "upper": 15 * 10**17},
    {"allocation": tokens(6_000_000), "lower": 15 * 10**17, "upper": 3 * WAD},
    {"allocation": tokens(3_000_000), "lower": 3 * WAD, "upper": 6 * WAD},
    {"allocation": tokens(1_000_000), "lower": 6 * WAD, "upper": 12 * WAD},
]


def ladder_state(price_multiple_wad: int, genesis_price_wad: int = WAD) -> Dict[str, Any]:
    positions: List[Dict[str, Any]] = []
    for price_range in LADDER:
        inverse_lower = inverse_sqrt_wad(price_range["lower"])
        inverse_upper = inverse_sqrt_wad(price_range["upper"])
        liquidity = mul_div(price_range["allocation"], WAD, inverse_lower - inverse_upper)
        if price_multiple_wad <= price_range["lower"]:
            gbx_remaining = price_range["allocation"]
            usd_g_raised_wad = 0
        elif price_multiple_wad >= price_range["upper"]:
            gbx_remaining = 0
            usd_g_raised_wad = mul_div(
                liquidity,
                sqrt_wad(price_range["upper"]) - sqrt_wad(price_range["lower"]),
                WAD,
            )
        else:
            gbx_remaining = mul_div(
                liquidity,
                inverse_sqrt_wad(price_multiple_wad) - inverse_upper,
                WAD,
            )
            usd_g_raised_wad = mul_div(
                liquidity,
                sqrt_wad(price_multiple_wad) - sqrt_wad(price_range["lower"]),
                WAD,
            )
        usd_g_raised_wad = mul_div(usd_g_raised_wad, genesis_price_wad, WAD)
        positions.append(
            {
                "gbxAllocation": price_range["allocation"],
                "lowerPriceMultipleWad": price_range["lower"],
                "upperPriceMultipleWad": price_range["upper"],
                "gbxRemaining": gbx_remaining,
                "usdGRaisedWad": usd_g_raised_wad,
                "usdGRaisedRaw": usd_g_raised_wad // USDG_NORMALIZATION_SCALE,
            }
        )
    gbx_remaining = sum(position["gbxRemaining"] for position in positions)
    usd_g_raised_wad = sum(position["usdGRaisedWad"] for position in positions)
    usd_g_raised_raw = sum(position["usdGRaisedRaw"] for position in positions)
    return {
        "priceMultipleWad": price_multiple_wad,
        "gbxRemaining": gbx_remaining,
        "gbxSold": GENESIS_LP_GBX - gbx_remaining,
        "usdGRaisedWad": usd_g_raised_wad,
        "usdGRaisedRaw": usd_g_raised_raw,
        "positions": positions,
    }


def quote_bootstrap(community_raise: int) -> Dict[str, Any]:
    sponsor = mul_div_up(community_raise, GENESIS_LP_GBX, GENESIS_MINER_GBX)
    total_backing = community_raise + sponsor
    initial_price = usdg_price_wad(community_raise, GENESIS_MINER_GBX)
    backing_per_gbx = usdg_price_wad(total_backing, GENESIS_SUPPLY)
    participant_contribution = community_raise // 100
    participant_gbx = mul_div(participant_contribution, GENESIS_MINER_GBX, community_raise)
    fully_converted_ladder_usdg_raw = ladder_state(12 * WAD, initial_price)["usdGRaisedRaw"]
    return {
        "communityRaiseUSDGRaw": community_raise,
        "sponsorRequirementUSDGRaw": sponsor,
        "totalGenesisBackingUSDGRaw": total_backing,
        "genesisMinerAllocation": GENESIS_MINER_GBX,
        "oneSidedLPAllocation": GENESIS_LP_GBX,
        "initialGBXPrice": initial_price,
        "backingPerGBX": backing_per_gbx,
        "lpBackingRequirementUSDGRaw": sponsor,
        "initialOneSidedLPUSDGRaw": 0,
        "fullyConvertedLadderUSDGRaw": fully_converted_ladder_usdg_raw,
        "participantContributionUSDGRaw": participant_contribution,
        "participantGBX": participant_gbx,
        "genesisRedemptionUSDGRaw": mul_div(total_backing, participant_gbx, GENESIS_SUPPLY),
    }


def auction_rate(reference_rate: int, elapsed_seconds: int) -> int:
    start = mul_div(reference_rate, 12_500, BPS)
    floor = mul_div(reference_rate, 8_000, BPS)
    if elapsed_seconds >= DAY:
        return floor
    return start - mul_div(start - floor, elapsed_seconds, DAY)


def market_rate_with_drift(start_rate: int, drift_bps: int, elapsed_seconds: int) -> int:
    magnitude = mul_div(start_rate, abs(drift_bps), BPS)
    elapsed_drift = mul_div(magnitude, elapsed_seconds, DAY)
    return start_rate - elapsed_drift if drift_bps < 0 else start_rate + elapsed_drift


def find_auction_fill_second(options: Dict[str, Any]) -> Optional[int]:
    if not options["makerAvailable"]:
        return None
    for second in range(DAY + 1):
        halted = (
            "haltStartSecond" in options
            and "haltEndSecond" in options
            and second >= options["haltStartSecond"]
            and second <= options["haltEndSecond"]
        )
        if halted:
            continue
        market_rate = market_rate_with_drift(options["marketStartRate"], options["dailyDriftBps"], second)
        if auction_rate(UNIT_TARGET_PER_USDG_RATE, second) <= market_rate:
            return second
    return None


def acquisition_destinations(acquired: int, has_active_weight: bool) -> Dict[str, Any]:
    nominal_manager_reward = mul_div(acquired, 200, BPS)
    manager_reward = nominal_manager_reward if has_active_weight else 0
    return {
        "acquired": acquired,
        "managerReward": manager_reward,
        "vaultGrowth": acquired - manager_reward,
        "redirectedToVault": 0 if has_active_weight else nominal_manager_reward,
    }


def budget_accumulation_trace() -> List[Dict[str, Any]]:
    budget = 0
    daily_revenue = usd_g(60_000)
    strategy_share_bps = 4_000
    lot = usd_g(50_000)
    trace: List[Dict[str, Any]] = []
    for day in range(1, 11):
        allocated = mul_div(daily_revenue, strategy_share_bps, BPS)
        budget += allocated
        maker_available = day >= 4
        trading_halted = day == 6
        filled = maker_available and not trading_halted and budget >= lot
        if filled:
            budget -= lot
        trace.append(
            {
                "day": day,
                "allocatedUSDGRaw": allocated,
                "makerAvailable": maker_available,
                "tradingHalted": trading_halted,
                "filled": filled,
                "lotSpentUSDGRaw": lot if filled else 0,
                "closingBudgetUSDGRaw": budget,
            }
        )
    return trace


def reward_concentration() -> Dict[str, Any]:
    reward = tokens(20)
    weights_bps = [7_000, 2_000, 1_000]
    distributed = 0
    managers: List[Dict[str, Any]] = []
    for index, weight_bps in enumerate(weights_bps):
        amount = reward - distributed if index == len(weights_bps) - 1 else mul_div(reward, weight_bps, BPS)
        distributed += amount
        managers.append({"manager": f"manager-{index + 1}", "weightBps": weight_bps, "reward": amount})
    hhi_bps = sum(mul_div(weight, weight, BPS) for weight in weights_bps)
    return {"totalReward": reward, "hhiBps": hhi_bps, "managers": managers}


def buyback_scenario(identifier: str, market_price: int) -> Dict[str, Any]:
    supply_before = tokens(100_000_000)
    vault_before = usd_g(100_000_000)
    spent = usd_g(10_000_000)
    burned = mul_div(normalize_usdg(spent), WAD, market_price)
    supply_after = supply_before - burned
    vault_after = vault_before - spent
    return {
        "id": identifier,
        "marketPrice": market_price,
        "backingPerGBXBefore": usdg_price_wad(vault_before, supply_before),
        "usdGSpentRaw": spent,
        "gbxBurned": burned,
        "vaultValueAfterUSDGRaw": vault_after,
        "supplyAfter": supply_after,
        "backingPerGBXAfter": usdg_price_wad(vault_after, supply_after),
    }


def revenue_funded_buyback(identifier: str) -> Dict[str, Any]:
    starting_supply = tokens(100_000_000)
    starting_vault = usd_g(100_000_000)
    revenue = usd_g(10_000_000) if identifier == "mining-revenue" else usd_g(1_000_000)
    emission = tokens(10_000_000) if identifier == "mining-revenue" else 0
    spend = usd_g(1_000_000)
    market_price = 8 * 10**17
    burned = mul_div(normalize_usdg(spend), WAD, market_price)
    supply_after = starting_supply + emission - burned
    vault_after = starting_vault + revenue - spend
    return {
        "id": identifier,
        "startingSupply": starting_supply,
        "startingVaultValueUSDGRaw": starting_vault,
        "revenueUSDGRaw": revenue,
        "emission": emission,
        "buybackSpendUSDGRaw": spend,
        "marketPrice": market_price,
        "gbxBurned": burned,
        "supplyAfter": supply_after,
        "vaultValueAfterUSDGRaw": vault_after,
        "backingPerGBXAfter": usdg_price_wad(vault_after, supply_after),
    }


def sequential_redemptions() -> List[Dict[str, Any]]:
    supply = tokens(100_000_000)
    balances = {"USDG": usd_g(100_000_000), "ASSET_A": tokens(200_000), "ASSET_B": tokens(50_000)}
    trace: List[Dict[str, Any]] = []
    for sequence, shares in enumerate([tokens(20_000_000), tokens(30_000_000), tokens(25_000_000)], start=1):
        supply_before = supply
        balances_before = dict(balances)
        output = {
            asset: mul_div(balance, shares, supply_before) for asset, balance in balances_before.items()
        }
        supply -= shares
        balances = {asset: balances_before[asset] - output[asset] for asset in balances_before}
        trace.append(
            {
                "sequence": sequence,
                "shares": shares,
                "supplyBefore": supply_before,
                "output": output,
                "supplyAfter": supply,
                "balancesAfter": dict(balances),
            }
        )
    return trace


def compute_economic_suite_raw() -> Dict[str, Any]:
    demand_scenarios = [
        simulate_demand_pattern(pattern)
        for pattern in ["fully-funded", "fifty-percent-funded", "sporadic-demand", "long-empty-period"]
    ]
    full_demand = demand_scenarios[0]
    burn_sweep: List[Dict[str, Any]] = []
    for checkpoint in full_demand["checkpoints"]:
        for burn_rate_bps in EMISSION_BURN_BPS:
            requested = mul_div(checkpoint["recurringMinted"], burn_rate_bps, BPS)
            actual = min(requested, checkpoint["totalCumulativeMinted"])
            burn_sweep.append(
                {
                    "days": checkpoint["days"],
                    "burnRateBps": burn_rate_bps,
                    "recurringMinted": checkpoint["recurringMinted"],
                    "requestedBurn": requested,
                    "actualBurn": actual,
                    "currentSupply": checkpoint["totalCumulativeMinted"] - actual,
                }
            )

    auction_drift_inputs = [
        {"id": "stable-market", "marketStartRate": UNIT_TARGET_PER_USDG_RATE, "dailyDriftBps": 0, "makerAvailable": True},
        {"id": "target-appreciates", "marketStartRate": UNIT_TARGET_PER_USDG_RATE, "dailyDriftBps": -2_000, "makerAvailable": True},
        {"id": "target-depreciates", "marketStartRate": UNIT_TARGET_PER_USDG_RATE, "dailyDriftBps": 2_000, "makerAvailable": True},
        {"id": "missing-market-maker", "marketStartRate": UNIT_TARGET_PER_USDG_RATE, "dailyDriftBps": 0, "makerAvailable": False},
        {
            "id": "trading-halt-at-crossing",
            "marketStartRate": UNIT_TARGET_PER_USDG_RATE,
            "dailyDriftBps": 0,
            "makerAvailable": True,
            "haltStartSecond": 36_000,
            "haltEndSecond": DAY,
        },
    ]
    price_multiples = [WAD, 125 * 10**16, 15 * 10**17, 2 * WAD, 3 * WAD, 6 * WAD, 12 * WAD]
    lp_inventory = [ladder_state(price_multiple) for price_multiple in price_multiples]
    reference_after_two_thousand_empty_epochs = WAD
    for _ in range(2_000):
        reference_after_two_thousand_empty_epochs = update_reference_price(
            reference_after_two_thousand_empty_epochs, 0, False
        )

    drift_results: List[Dict[str, Any]] = []
    for input_case in auction_drift_inputs:
        fill_second = find_auction_fill_second(input_case)
        lot = usd_g(10_000)
        fill_rate = None if fill_second is None else auction_rate(UNIT_TARGET_PER_USDG_RATE, fill_second)
        drift_results.append(
            {
                **input_case,
                "usdGLotRaw": lot,
                "fillSecond": fill_second,
                "fillRate": fill_rate,
                "requiredTarget": None
                if fill_rate is None
                else mul_div_up(normalize_usdg(lot), fill_rate, WAD),
                "budgetRetainedUSDGRaw": lot if fill_second is None else 0,
            }
        )

    strategy_yields: List[Dict[str, Any]] = []
    strategy_inputs = [
        {"id": "strategy-a", "activeWeight": tokens(1_000_000), **acquisition_destinations(tokens(1_000), True)},
        {"id": "strategy-b", "activeWeight": tokens(2_000_000), **acquisition_destinations(tokens(5_000), True)},
        {
            "id": "strategy-without-live-weight",
            "activeWeight": 0,
            **acquisition_destinations(tokens(5_000), False),
        },
    ]
    for strategy in strategy_inputs:
        strategy_yields.append(
            {
                **strategy,
                "rewardPerActiveGBX": 0
                if strategy["activeWeight"] == 0
                else mul_div(strategy["managerReward"], WAD, strategy["activeWeight"]),
            }
        )

    simultaneous: List[Dict[str, Any]] = []
    for burn_rate_bps in [0, 5_000, 10_000, 15_000]:
        starting_supply = tokens(100_000_000)
        emission = tokens(10_000_000)
        burn = mul_div(emission, burn_rate_bps, BPS)
        simultaneous.append(
            {
                "burnRateBps": burn_rate_bps,
                "startingSupply": starting_supply,
                "emission": emission,
                "burn": burn,
                "netSupplyChange": emission - burn,
                "supplyAfter": starting_supply + emission - burn,
            }
        )

    return {
        "schemaVersion": 2,
        "purpose": "Deterministic protocol-mechanics scenarios; not forecasts, valuations, or investment projections.",
        "assumptions": {
            "arithmetic": "Unsigned integer arithmetic with explicit floor/ceiling semantics; GBX and modeled targets use 18 decimals, canonical USDG uses raw 6-decimal units.",
            "wad": WAD,
            "usdGDecimals": USDG_DECIMALS,
            "usdGAtomicUnit": USDG_UNIT,
            "usdGNormalizationScale": USDG_NORMALIZATION_SCALE,
            "targetTokenDecimals": 18,
            "unitTargetPerUSDGRate": UNIT_TARGET_PER_USDG_RATE,
            "bpsDenominator": BPS,
            "horizonDays": HORIZON_DAYS,
            "cumulativeMintCap": MAX_CUMULATIVE_MINT,
            "genesisSupply": GENESIS_SUPPLY,
            "auctionDurationSeconds": DAY,
            "managerRewardBps": 200,
            "noOnchainNavOracle": True,
        },
        "emissions": {
            "demandScenarios": demand_scenarios,
            "priceShockTraces": [
                price_shock_trace("large-price-increase", [8 * WAD] * 10),
                price_shock_trace("large-price-decrease", [WAD // 10] * 10),
                price_shock_trace(
                    "reference-price-lag",
                    [WAD, WAD, 2 * WAD, 2 * WAD, 4 * WAD, 4 * WAD, WAD, WAD, WAD, WAD],
                ),
            ],
            "roundingRegressions": {
                "solidityTermByTermEma": update_reference_price(101, 104, True),
                "referenceAfterTwoThousandEmptyEpochs": reference_after_two_thousand_empty_epochs,
                "minimumNonzeroPrice": minimum_mining_price(reference_after_two_thousand_empty_epochs),
                "affordableGBXWeiFromOneRawUSDGAtOneDollar": mul_div(normalize_usdg(1), WAD, WAD),
            },
            "burnSweep": burn_sweep,
        },
        "bootstrap": {
            "raises": [quote_bootstrap(usd_g(amount)) for amount in [1_000_000, 10_000_000, 80_000_000, 160_000_000]],
            "ladderRanges": LADDER,
            "lpInventory": lp_inventory,
            "fullyConvertedUSDGRawAtOneDollarP0": lp_inventory[-1]["usdGRaisedRaw"],
            "sixDecimalRegression": {
                "oneUSDGRaw": USDG_UNIT,
                "normalizedOneUSDG": normalize_usdg(USDG_UNIT),
                "oneTargetPerUSDGRate": UNIT_TARGET_PER_USDG_RATE,
                "targetRequiredForOneUSDG": mul_div_up(
                    normalize_usdg(USDG_UNIT), UNIT_TARGET_PER_USDG_RATE, WAD
                ),
            },
        },
        "auctions": {
            "bounds": {
                "referenceRate": UNIT_TARGET_PER_USDG_RATE,
                "startRate": auction_rate(UNIT_TARGET_PER_USDG_RATE, 0),
                "floorRate": auction_rate(UNIT_TARGET_PER_USDG_RATE, DAY),
                "startRateBps": 12_500,
                "floorRateBps": 8_000,
            },
            "curve": [
                {"elapsedSeconds": elapsed, "rate": auction_rate(UNIT_TARGET_PER_USDG_RATE, elapsed)}
                for elapsed in [0, 21_600, 43_200, 64_800, DAY]
            ],
            "driftAndAvailability": drift_results,
            "lotSizesAtMidpoint": [
                {
                    "usdGLotRaw": usd_g(amount),
                    "rate": auction_rate(UNIT_TARGET_PER_USDG_RATE, DAY // 2),
                    "requiredTarget": mul_div_up(
                        normalize_usdg(usd_g(amount)),
                        auction_rate(UNIT_TARGET_PER_USDG_RATE, DAY // 2),
                        WAD,
                    ),
                }
                for amount in [1_000, 10_000, 100_000]
            ],
            "budgetAccumulation": budget_accumulation_trace(),
        },
        "managerRewards": {
            "rewardYieldByStrategy": strategy_yields,
            "voteConcentration": reward_concentration(),
            "frequentSwitching": [
                {"hour": 0, "event": "signal-strategy-b", "activeStrategy": "none", "pendingStrategy": "strategy-b", "reward": 0},
                {"hour": 12, "event": "fill-strategy-b-before-activation", "activeStrategy": "none", "pendingStrategy": "strategy-b", "reward": 0},
                {"hour": 24, "event": "checkpoint-and-fill-strategy-b", "activeStrategy": "strategy-b", "pendingStrategy": "none", "reward": tokens(20)},
                {"hour": 30, "event": "switch-to-strategy-a", "activeStrategy": "none", "pendingStrategy": "strategy-a", "reward": 0},
                {"hour": 36, "event": "fill-strategy-a-during-delay", "activeStrategy": "none", "pendingStrategy": "strategy-a", "reward": 0},
                {"hour": 54, "event": "checkpoint-and-fill-strategy-a", "activeStrategy": "strategy-a", "pendingStrategy": "none", "reward": tokens(20)},
            ],
            "activationDelay": [
                {"elapsedSeconds": 0, "effectiveWeight": 0, "pendingWeight": tokens(100_000)},
                {"elapsedSeconds": DAY - 1, "effectiveWeight": 0, "pendingWeight": tokens(100_000)},
                {"elapsedSeconds": DAY, "effectiveWeight": tokens(100_000), "pendingWeight": 0},
            ],
            "noLockStakeChurn": {
                "earlyExit": {
                    "stakedAtSecond": 0,
                    "unstakedAtSecond": 21_600,
                    "activeWeightAtExit": 0,
                    "cancelledPendingWeight": tokens(100_000),
                    "rewardCaptured": 0,
                },
                "postActivationExit": {
                    "stakedAtSecond": 0,
                    "activatedAtSecond": DAY,
                    "filledAtSecond": DAY,
                    "unstakedAtSecond": DAY,
                    "activeWeightAtFill": tokens(100_000),
                    "accruedRewardAfterUnstake": tokens(20),
                },
            },
            "rewardLeakageVsVaultGrowth": [
                {"id": "one-hundred-fills-with-live-weight", "fillCount": 100, **acquisition_destinations(tokens(100_000), True)},
                {"id": "ten-fills-without-live-weight", "fillCount": 10, **acquisition_destinations(tokens(10_000), False)},
            ],
        },
        "redemptionAndBuyback": {
            "marketRelativeToBacking": [
                buyback_scenario("gbx-below-backing", 8 * 10**17),
                buyback_scenario("gbx-above-backing", 12 * 10**17),
            ],
            "revenueSourceComparison": [revenue_funded_buyback("mining-revenue"), revenue_funded_buyback("lp-fee-revenue")],
            "simultaneousEmissionAndBurn": simultaneous,
            "sequentialLargeRedemptions": sequential_redemptions(),
            "lpInventorySoldOverTime": lp_inventory,
        },
    }


def decimalize(value: Any) -> Any:
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value
    if isinstance(value, int):
        return str(value)
    if isinstance(value, list):
        return [decimalize(item) for item in value]
    if isinstance(value, dict):
        return {key: decimalize(nested) for key, nested in value.items()}
    raise TypeError(f"unsupported fixture value: {type(value).__name__}")


def compute_economic_suite() -> Dict[str, Any]:
    return decimalize(compute_economic_suite_raw())


def main() -> None:
    if len(sys.argv) > 2:
        raise SystemExit("usage: economic_model.py [OUTPUT_JSON]")
    payload = json.dumps(compute_economic_suite(), separators=(",", ":"), sort_keys=True)
    if len(sys.argv) == 2:
        Path(sys.argv[1]).write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)


if __name__ == "__main__":
    main()
