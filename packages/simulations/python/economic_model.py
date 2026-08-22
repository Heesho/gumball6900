"""Independent integer-only model of fixed-slot mining and constant-time effective-supply redemption."""

from __future__ import annotations

import json

WAD = 10**18
BPS = 10_000
DEFAULT_STRATEGY_BRIBE_BPS = 1_000
MAX_STRATEGY_BRIBE_BPS = 2_000
HOUR = 3_600
YEAR = 365 * 24 * HOUR
GENESIS = 20_000_000 * WAD
MINE_PRICE_MULTIPLIER = 2
MINE_MINIMUM_INITIAL_PRICE = 1_000_000
MINE_INITIAL_TPS = 64 * WAD
MINE_HALVING_PERIOD = 69 * 24 * HOUR
MINE_TAIL_TPS = WAD


def mul_div(a: int, b: int, denominator: int) -> int:
    return a * b // denominator


def mining_price(initial: int, elapsed: int) -> int:
    return 0 if elapsed >= HOUR else initial - mul_div(initial, elapsed, HOUR)


def mining_rate_at(elapsed_since_start: int) -> int:
    shifted = MINE_INITIAL_TPS >> (elapsed_since_start // MINE_HALVING_PERIOD)
    return max(shifted, MINE_TAIL_TPS)


def first_tail_boundary() -> int:
    for boundary in range(256):
        if MINE_INITIAL_TPS >> boundary <= MINE_TAIL_TPS:
            return boundary
    raise ValueError("positive tail must be reached within uint256 shift bounds")


MINE_TAIL_BOUNDARY_COUNT = first_tail_boundary()


def synchronized_mining_emission(elapsed_since_start: int) -> int:
    if elapsed_since_start < 0:
        raise ValueError("elapsed time must be non-negative")

    emission = 0
    for era in range(MINE_TAIL_BOUNDARY_COUNT):
        era_start = era * MINE_HALVING_PERIOD
        if elapsed_since_start <= era_start:
            break
        active_seconds = min(elapsed_since_start - era_start, MINE_HALVING_PERIOD)
        emission += mining_rate_at(era_start) * active_seconds

    tail_start = MINE_TAIL_BOUNDARY_COUNT * MINE_HALVING_PERIOD
    if elapsed_since_start > tail_start:
        emission += MINE_TAIL_TPS * (elapsed_since_start - tail_start)
    return emission


def split(payment: int, has_previous: bool) -> dict[str, int]:
    previous = mul_div(payment, 8_000, BPS) if has_previous else 0
    return {"payment": payment, "previousMiner": previous, "resonance": payment - previous}


def classify_strategy_payments(
    payments: list[int], bribe_bps: int | list[int] = DEFAULT_STRATEGY_BRIBE_BPS
) -> dict[str, object]:
    rates = [bribe_bps] * len(payments) if isinstance(bribe_bps, int) else bribe_bps
    if len(rates) != len(payments):
        raise ValueError("every Strategy payment needs one Bribe rate")
    if any(payment < 0 for payment in payments):
        raise ValueError("Strategy payments must be non-negative")
    if any(rate < 0 or rate > MAX_STRATEGY_BRIBE_BPS for rate in rates):
        raise ValueError("Strategy Bribe rate outside protocol bounds")

    fund = 0
    bribe = 0
    remainder = 0
    for payment, rate in zip(payments, rates, strict=True):
        base_bribe, raw_remainder = divmod(payment * rate, BPS)
        carry, remainder = divmod(remainder + raw_remainder, BPS)
        bribe_amount = base_bribe + carry
        fund += payment - bribe_amount
        bribe += bribe_amount
    return {
        "payments": payments,
        "bribeBps": rates,
        "totalPayment": sum(payments),
        "fundLiability": fund,
        "bribeLiability": bribe,
        "splitRemainder": remainder,
    }


def compute() -> dict[str, object]:
    global_tps = mining_rate_at(0) * HOUR
    incumbent = global_tps // 16
    post_halving = (mining_rate_at(MINE_HALVING_PERIOD) * HOUR) // 16
    all_slot_rates = [incumbent] * 16
    time_based_schedule = [
        MINE_HALVING_PERIOD - 1,
        MINE_HALVING_PERIOD,
        2 * MINE_HALVING_PERIOD - 1,
        2 * MINE_HALVING_PERIOD,
        MINE_TAIL_BOUNDARY_COUNT * MINE_HALVING_PERIOD - 1,
        MINE_TAIL_BOUNDARY_COUNT * MINE_HALVING_PERIOD,
        1_000 * MINE_HALVING_PERIOD,
    ]
    boundary_rates = [
        {
            "boundaryIndex": boundary,
            "elapsedSinceStart": boundary * MINE_HALVING_PERIOD,
            "globalTps": mining_rate_at(boundary * MINE_HALVING_PERIOD),
        }
        for boundary in range(MINE_TAIL_BOUNDARY_COUNT + 1)
    ]
    synchronized_boundary_supply = []
    for point in boundary_rates:
        mining_emission = synchronized_mining_emission(point["elapsedSinceStart"])
        synchronized_boundary_supply.append(
            {
                **point,
                "miningEmission": mining_emission,
                "grossSupply": GENESIS + mining_emission,
            }
        )
    synchronized_horizon_supply = []
    for years in (1, 3, 5, 10, 40):
        elapsed_since_start = years * YEAR
        mining_emission = synchronized_mining_emission(elapsed_since_start)
        synchronized_horizon_supply.append(
            {
                "years": years,
                "elapsedSinceStart": elapsed_since_start,
                "miningEmission": mining_emission,
                "grossSupply": GENESIS + mining_emission,
            }
        )
    tail_starts_at_seconds = MINE_TAIL_BOUNDARY_COUNT * MINE_HALVING_PERIOD
    synchronized_tail_relative_horizon_supply = []
    for years_after_tail in (1, 2, 5, 10):
        elapsed_since_tail = years_after_tail * YEAR
        elapsed_since_start = tail_starts_at_seconds + elapsed_since_tail
        mining_emission = synchronized_mining_emission(elapsed_since_start)
        gross_supply = GENESIS + mining_emission
        synchronized_tail_relative_horizon_supply.append(
            {
                "yearsAfterTail": years_after_tail,
                "elapsedSinceTail": elapsed_since_tail,
                "elapsedSinceStart": elapsed_since_start,
                "miningEmission": mining_emission,
                "grossSupply": gross_supply,
                "annualTailInflationPpm": mul_div(
                    MINE_TAIL_TPS * YEAR, 1_000_000, gross_supply
                ),
            }
        )
    mining_emission_at_tail = synchronized_mining_emission(tail_starts_at_seconds)
    supply = 100_000_000 * WAD
    pending = 1_000_000 * WAD
    fund_usdg = 50_000_000 * 10**6
    redeem = 1_000_000 * WAD
    return {
        "schemaVersion": 13,
        "purpose": "Deterministic protocol mechanics; not forecasts, valuations, or investment projections.",
        "assumptions": {
            "genesisLiquidityAllocationGBXRaw": GENESIS,
            "infiniteSupply": True,
            "priceDecaySeconds": HOUR,
            "previousMinerBps": 8_000,
            "resonanceRevenueBps": 2_000,
            "fixedSlotCount": 16,
            "minePriceMultiplier": MINE_PRICE_MULTIPLIER,
            "mineMinimumInitialPrice": MINE_MINIMUM_INITIAL_PRICE,
            "mineInitialTps": MINE_INITIAL_TPS,
            "mineHalvingPeriodSeconds": MINE_HALVING_PERIOD,
            "mineTailTps": MINE_TAIL_TPS,
            "mineTailBoundaryCount": MINE_TAIL_BOUNDARY_COUNT,
            "tenureRatesLocked": True,
            "redemptionsUseConstantTimeEffectiveSupply": True,
            "checkpointAllExists": False,
            "defaultStrategyBribeBps": DEFAULT_STRATEGY_BRIBE_BPS,
            "maximumStrategyBribeBps": MAX_STRATEGY_BRIBE_BPS,
            "minimumStrategyBribeBps": 0,
            "strategyFundBpsIsDerived": True,
        },
        "mining": {
            "timeBasedSchedule": {
                "points": [
                    {"elapsedSinceStart": elapsed, "globalTps": mining_rate_at(elapsed)}
                    for elapsed in time_based_schedule
                ],
                "boundaryRates": boundary_rates,
                "emptyMarketAtFirstBoundary": {
                    "elapsedSinceStart": MINE_HALVING_PERIOD,
                    "totalMined": 0,
                    "pendingEmission": 0,
                    "globalTps": mining_rate_at(MINE_HALVING_PERIOD),
                },
                "explanation": "The prospective rate depends only on elapsed deployment time; empty occupancy and zero mining do not pause it.",
            },
            "synchronizedSupply": {
                "referenceCase": "synchronized-full-refresh-no-burn",
                "modelAssumption": "Synchronized full-refresh, no-burn reference: all sixteen slots are occupied from deployment, all sixteen refresh to the prospective rate at every boundary, and all accrued emission is settled. Actual tenure-locked issuance depends on slot occupancy and turnover; this is neither a supply cap nor a forecast.",
                "boundaryPoints": synchronized_boundary_supply,
                "horizonPoints": synchronized_horizon_supply,
                "tailRelativeHorizonPoints": synchronized_tail_relative_horizon_supply,
                "tailBoundaryCount": MINE_TAIL_BOUNDARY_COUNT,
                "tailStartsAtSeconds": tail_starts_at_seconds,
                "miningEmissionAtTail": mining_emission_at_tail,
                "grossSupplyAtTail": GENESIS + mining_emission_at_tail,
                "minedBpsOfGrossSupplyAtTail": mul_div(
                    mining_emission_at_tail, BPS, GENESIS + mining_emission_at_tail
                ),
                "annualTailInflationPpmAtTail": mul_div(
                    MINE_TAIL_TPS * YEAR,
                    1_000_000,
                    GENESIS + mining_emission_at_tail,
                ),
            },
            "priceCurve": [
                {"elapsedSeconds": elapsed, "priceRaw": mining_price(2_000_000, elapsed)}
                for elapsed in (0, 900, 1_800, 2_700, 3_600)
            ],
            "paymentSplits": [
                {"id": "empty-slot", **split(1_000_000, False)},
                {"id": "replacement", **split(1_000_000, True)},
            ],
            "staggeredFixedSlots": {
                "incumbentRatePerHour": incumbent,
                "incumbentRateAfterHalvingPerHour": incumbent,
                "newTenureRatePerHour": post_halving,
                "oneHourEmissions": [incumbent, post_halving, post_halving],
                "aggregateOneHourEmission": incumbent + post_halving * 2,
                "explanation": "All slots divide the global TPS by sixteen. A halving affects only newly occupied or replaced tenures.",
            },
            "allSlotsBeforeHalving": {
                "slotCount": 16,
                "assignedRatesPerHour": all_slot_rates,
                "aggregateOneHourEmission": sum(all_slot_rates),
                "globalRatePerHour": global_tps,
                "aggregateBpsOfGlobalRate": mul_div(sum(all_slot_rates), BPS, global_tps),
                "explanation": "Sixteen occupied slots at the same generation exactly reproduce the global rate.",
            },
            "handoffHalving": {
                "halvingPeriodSeconds": MINE_HALVING_PERIOD,
                "globalRateBeforePerHour": global_tps,
                "globalRateAfterPerHour": mining_rate_at(MINE_HALVING_PERIOD) * HOUR,
                "incumbentSlotRateAfterBoundaryPerHour": incumbent,
                "nextReplacementSlotRatePerHour": post_halving,
                "aggregateLockedSixteenSlotsPerHour": sum(all_slot_rates),
            },
            "infiniteTail": {
                "tailRatePerSecond": MINE_TAIL_TPS,
                "annualTailEmission": MINE_TAIL_TPS * YEAR,
                "years": [
                    {"years": years, "emission": MINE_TAIL_TPS * YEAR * years} for years in (1, 10, 100)
                ],
            },
        },
        "redemption": {
            "mintedSupplyBefore": supply,
            "pendingMining": pending,
            "effectiveSupplyBeforeBurn": supply + pending,
            "fundUSDGRaw": fund_usdg,
            "redeemGBX": redeem,
            "payoutIgnoringPendingRaw": mul_div(fund_usdg, redeem, supply),
            "payoutWithEffectiveSupplyRaw": mul_div(fund_usdg, redeem, supply + pending),
        },
        "genesisLiquidity": {
            "publicBootstrap": False,
            "genesisLiquidityAllocationGBXRaw": GENESIS,
            "oneSidedPositionBudgetGBXRaw": GENESIS,
            "positionPrincipalRemainsFixed": True,
        },
        "strategyAuction": {
            "durationSeconds": 86_400,
            "curve": [
                {
                    "elapsedSeconds": elapsed,
                    "paymentAmount": 0
                    if elapsed >= 86_400
                    else 100 * WAD - mul_div(100 * WAD, elapsed, 86_400),
                }
                for elapsed in (0, 21_600, 43_200, 64_800, 86_400)
            ],
            "cumulativeSplitIsFrequencyIndependent": True,
            "tenOneUnitPayments": classify_strategy_payments([1] * 10),
            "oneCombinedPayment": classify_strategy_payments([10]),
            "rateChangeSequence": classify_strategy_payments(
                [7, 13, 19, 23], [1_000, 0, 500, 2_000]
            ),
            "zeroPercentPayments": classify_strategy_payments([1, 7, 1_000_000], 0),
            "directRouterDonationSurplus": 7,
        },
        "supply": {
            "identity": "totalSupply = lifetimeMinted - lifetimeBurned",
            "lifetimeMinted": 125_000_000 * WAD,
            "lifetimeBurned": 5_000_000 * WAD,
            "totalSupply": 120_000_000 * WAD,
            "maximumSupply": None,
        },
    }


def decimal(value: object) -> object:
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value
    if isinstance(value, int):
        return str(value)
    if isinstance(value, list):
        return [decimal(item) for item in value]
    if isinstance(value, dict):
        return {key: decimal(item) for key, item in value.items()}
    raise TypeError(type(value))


if __name__ == "__main__":
    print(json.dumps(decimal(compute()), indent=2))
