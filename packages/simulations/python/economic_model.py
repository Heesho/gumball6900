"""Independent integer-only model for the master-spec section 33 scenarios."""

from __future__ import annotations

import json
import sys
from decimal import Decimal, ROUND_FLOOR, localcontext
from pathlib import Path
from typing import Any, Dict, List

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
GENESIS_LP_GBX = 20_000_000 * WAD
GENESIS_SUPPLY = GENESIS_LP_GBX
MINING_EMISSION_ALLOCATION = MAX_CUMULATIVE_MINT - GENESIS_SUPPLY
DAILY_DECAY_WAD = 999_525_354_337_060_160


def derive_initial_daily_emission() -> int:
    with localcontext() as context:
        context.prec = 100
        daily_real_decay = Decimal(2) ** (Decimal(-1) / Decimal(1460))
        derived = Decimal(MINING_EMISSION_ALLOCATION) * (Decimal(1) - daily_real_decay)
        return int(derived.to_integral_value(rounding=ROUND_FLOOR))


INITIAL_DAILY_EMISSION = derive_initial_daily_emission()

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


def contribution_for_epoch(pattern: str, day_index: int) -> int:
    if pattern == "all-nonempty-large":
        return usd_g(1_000)
    if pattern == "all-nonempty-one-atom":
        return 1
    if pattern == "sporadic-nonempty":
        weekly = [1, 0, usd_g(100), 0, usd_g(1_000), 1, 0]
        return weekly[day_index % len(weekly)]
    if pattern == "long-empty-period":
        if day_index < 365:
            return 1
        if day_index < 2_365:
            return 0
        return 1 if day_index % 3 == 0 else 0
    raise ValueError(f"unknown participation pattern: {pattern}")


def simulate_participation_pattern(pattern: str) -> Dict[str, Any]:
    scheduled = INITIAL_DAILY_EMISSION
    cumulative_minted = GENESIS_SUPPLY
    total_usdg_accepted_raw = 0
    forfeited_scheduled = 0
    non_empty_epochs = 0
    empty_epochs = 0
    checkpoints: List[Dict[str, Any]] = []

    for day_index in range(HORIZON_DAYS[-1]):
        epoch_scheduled = min(scheduled, MAX_CUMULATIVE_MINT - cumulative_minted)
        contributed_usdg_raw = contribution_for_epoch(pattern, day_index)
        actual_emission = 0 if contributed_usdg_raw == 0 else epoch_scheduled

        cumulative_minted += actual_emission
        total_usdg_accepted_raw += contributed_usdg_raw
        if contributed_usdg_raw == 0:
            empty_epochs += 1
            forfeited_scheduled += scheduled
        else:
            non_empty_epochs += 1

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
                    "forfeitedScheduled": forfeited_scheduled,
                    "nonEmptyEpochs": non_empty_epochs,
                    "emptyEpochs": empty_epochs,
                }
            )
    return {"id": pattern, "checkpoints": checkpoints}


def emission_schedule_lifetime() -> Dict[str, int]:
    emission = INITIAL_DAILY_EMISSION
    scheduled_total = 0
    positive_epochs = 0
    while emission != 0:
        scheduled_total += emission
        emission = mul_div(emission, DAILY_DECAY_WAD, WAD)
        positive_epochs += 1
    return {
        "positiveEpochs": positive_epochs,
        "sequentialScheduledTotal": scheduled_total,
        "nominalAllocationResidual": MINING_EMISSION_ALLOCATION - scheduled_total,
    }


def auction_price(init_price: int, elapsed_seconds: int, epoch_period: int = DAY) -> int:
    if init_price <= 0 or elapsed_seconds < 0 or epoch_period <= 0:
        raise ValueError("invalid auction input")
    if elapsed_seconds > epoch_period:
        return 0
    return init_price - mul_div(init_price, elapsed_seconds, epoch_period)


def next_auction_init_price(payment_amount: int, price_multiplier: int, min_init_price: int) -> int:
    absolute_maximum = 2**192 - 1
    return min(max(mul_div(payment_amount, price_multiplier, WAD), min_init_price), absolute_maximum)


def strategy_settlement(payment_amount: int) -> Dict[str, Any]:
    return {
        "paymentAmount": payment_amount,
        "fundAmount": payment_amount,
        "auctionBribeReward": 0,
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
    signalers: List[Dict[str, Any]] = []
    for index, weight_bps in enumerate(weights_bps):
        amount = reward - distributed if index == len(weights_bps) - 1 else mul_div(reward, weight_bps, BPS)
        distributed += amount
        signalers.append({"signaler": f"signaler-{index + 1}", "weightBps": weight_bps, "reward": amount})
    hhi_bps = sum(mul_div(weight, weight, BPS) for weight in weights_bps)
    return {"totalReward": reward, "hhiBps": hhi_bps, "signalers": signalers}


def gbx_acquisition_and_burn_scenario(identifier: str, market_price: int) -> Dict[str, Any]:
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
        "gbxAcquisitionBudgetUSDGRaw": spent,
        "gbxBurned": burned,
        "vaultValueAfterUSDGRaw": vault_after,
        "supplyAfter": supply_after,
        "backingPerGBXAfter": usdg_price_wad(vault_after, supply_after),
    }


def mining_revenue_funded_gbx_acquisition_and_burn() -> Dict[str, Any]:
    starting_supply = tokens(100_000_000)
    starting_vault = usd_g(100_000_000)
    revenue = usd_g(10_000_000)
    emission = tokens(10_000_000)
    spend = usd_g(1_000_000)
    market_price = 8 * 10**17
    burned = mul_div(normalize_usdg(spend), WAD, market_price)
    supply_after = starting_supply + emission - burned
    vault_after = starting_vault + revenue - spend
    return {
        "id": "mining-revenue",
        "startingSupply": starting_supply,
        "startingVaultValueUSDGRaw": starting_vault,
        "revenueUSDGRaw": revenue,
        "emission": emission,
        "gbxAcquisitionBudgetUSDGRaw": spend,
        "marketPrice": market_price,
        "gbxBurned": burned,
        "supplyAfter": supply_after,
        "vaultValueAfterUSDGRaw": vault_after,
        "backingPerGBXAfter": usdg_price_wad(vault_after, supply_after),
    }


def lp_fee_harvest() -> Dict[str, Any]:
    principal_liquidity = 1_000_000_000_000_000_000
    starting_supply = tokens(100_000_000)
    usdg_fees = usd_g(1_000_000)
    gbx_fees = tokens(1_250_000)
    return {
        "id": "lp-fee-harvest",
        "principalLiquidityBefore": principal_liquidity,
        "principalLiquidityAfter": principal_liquidity,
        "usdgFeesRaw": usdg_fees,
        "usdgRoutedToResonanceRaw": usdg_fees,
        "gbxFees": gbx_fees,
        "gbxSentToFund": gbx_fees,
        "gbxBurned": gbx_fees,
        "startingSupply": starting_supply,
        "supplyAfter": starting_supply - gbx_fees,
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


def reward_index_example(reward_amount: int, total_weight: int, precision: int = 10**27) -> Dict[str, int]:
    reward_per_weight_increment = mul_div(reward_amount, precision, total_weight)
    indexed_reward = mul_div(reward_per_weight_increment, total_weight, precision)
    return {
        "rewardAmount": reward_amount,
        "totalWeight": total_weight,
        "rewardPerWeightIncrement": reward_per_weight_increment,
        "indexedReward": indexed_reward,
        "residue": reward_amount - indexed_reward,
    }


def compute_economic_suite_raw() -> Dict[str, Any]:
    participation_scenarios = [
        simulate_participation_pattern(pattern)
        for pattern in [
            "all-nonempty-large",
            "all-nonempty-one-atom",
            "sporadic-nonempty",
            "long-empty-period",
        ]
    ]
    all_non_empty = participation_scenarios[0]
    burn_sweep: List[Dict[str, Any]] = []
    for checkpoint in all_non_empty["checkpoints"]:
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

    auction_init_price = tokens(100_000)
    auction_multiplier = 2 * WAD
    auction_min_init_price = 1_000_000

    strategy_yields: List[Dict[str, Any]] = []
    strategy_inputs = [
        {"id": "strategy-a", "activeWeight": tokens(1_000_000), "notifiedReward": tokens(100)},
        {"id": "strategy-b", "activeWeight": tokens(2_000_000), "notifiedReward": tokens(500)},
        {"id": "strategy-without-live-weight", "activeWeight": 0, "notifiedReward": tokens(500)},
    ]
    for strategy in strategy_inputs:
        strategy_yields.append(
            {
                **strategy,
                "rewardPerActiveGBX": 0
                if strategy["activeWeight"] == 0
                else mul_div(strategy["notifiedReward"], WAD, strategy["activeWeight"]),
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
        "schemaVersion": 3,
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
            "miningEmissionAllocation": MINING_EMISSION_ALLOCATION,
            "initialDailyScheduledEmission": INITIAL_DAILY_EMISSION,
            "dailyDecayWad": DAILY_DECAY_WAD,
            "auctionDurationSeconds": DAY,
            "strategyPaymentFundBps": BPS,
            "auctionProceedsFundBribes": False,
            "noOnchainNavOracle": True,
        },
        "emissions": {
            "participationScenarios": participation_scenarios,
            "scheduleLifetime": emission_schedule_lifetime(),
            "roundingRegressions": {
                "nextScheduledEmission": mul_div(INITIAL_DAILY_EMISSION, DAILY_DECAY_WAD, WAD),
                "oneAtomContributionEmission": INITIAL_DAILY_EMISSION,
                "largeContributionEmission": INITIAL_DAILY_EMISSION,
                "emptyContributionEmission": 0,
            },
            "burnSweep": burn_sweep,
        },
        "genesisLiquidity": {
            "publicBootstrap": False,
            "constructorMintGBXRaw": GENESIS_LP_GBX,
            "oneSidedPositionBudgetGBXRaw": GENESIS_LP_GBX,
            "unusedResidualPolicy": "burn",
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
                "minEpochPeriod": 3_600,
                "maxEpochPeriod": 365 * DAY,
                "minPriceMultiplier": 1_100_000_000_000_000_000,
                "maxPriceMultiplier": 3 * WAD,
                "absoluteMinInitPrice": 1_000_000,
                "absoluteMaxInitPrice": 2**192 - 1,
            },
            "curve": [
                {
                    "elapsedSeconds": elapsed,
                    "paymentAmount": auction_price(auction_init_price, elapsed),
                }
                for elapsed in [0, 21_600, 43_200, 64_800, DAY - 1, DAY, DAY + 1]
            ],
            "transitions": [
                {
                    "elapsedSeconds": elapsed,
                    "quotedPaymentAmount": auction_price(auction_init_price, elapsed),
                    "nextInitPrice": next_auction_init_price(
                        auction_price(auction_init_price, elapsed),
                        auction_multiplier,
                        auction_min_init_price,
                    ),
                }
                for elapsed in [0, DAY // 2, DAY, DAY + 1]
            ],
            "budgetAccumulation": budget_accumulation_trace(),
        },
        "bribeRewards": {
            "rewardYieldByStrategy": strategy_yields,
            "signalConcentration": reward_concentration(),
            "rewardIndexExamples": [
                {
                    "id": "production-scale",
                    **reward_index_example(840_000_000_000_000_000, tokens(200)),
                },
                {"id": "independent-floor-residue", **reward_index_example(10, 3, 10)},
            ],
            "strategySettlementConservation": [
                {"id": "one-hundred-fills-with-live-weight", "fillCount": 100, **strategy_settlement(tokens(100_000))},
                {"id": "ten-fills-without-live-weight", "fillCount": 10, **strategy_settlement(tokens(10_000))},
            ],
        },
        "redemptionAndGbxBurn": {
            "marketRelativeToBacking": [
                gbx_acquisition_and_burn_scenario("gbx-below-backing", 8 * 10**17),
                gbx_acquisition_and_burn_scenario("gbx-above-backing", 12 * 10**17),
            ],
            "miningRevenueAcquisitionAndBurn": mining_revenue_funded_gbx_acquisition_and_burn(),
            "liquidityFeeHarvest": lp_fee_harvest(),
            "simultaneousEmissionAndBurn": simultaneous,
            "sequentialLargeRedemptions": sequential_redemptions(),
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
