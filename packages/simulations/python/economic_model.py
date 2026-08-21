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


def mul_div(a: int, b: int, denominator: int) -> int:
    return a * b // denominator


def mining_price(initial: int, elapsed: int) -> int:
    return 0 if elapsed >= HOUR else initial - mul_div(initial, elapsed, HOUR)


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
    global_tps = 100 * WAD
    incumbent = global_tps // 16
    post_halving = (global_tps // 2) // 16
    all_slot_rates = [incumbent] * 16
    supply = 100_000_000 * WAD
    pending = 1_000_000 * WAD
    fund_usdg = 50_000_000 * 10**6
    redeem = 1_000_000 * WAD
    return {
        "schemaVersion": 9,
        "purpose": "Deterministic protocol mechanics; not forecasts, valuations, or investment projections.",
        "assumptions": {
            "genesisLiquidityAllocationGBXRaw": GENESIS,
            "infiniteSupply": True,
            "priceDecaySeconds": HOUR,
            "previousMinerBps": 8_000,
            "resonanceRevenueBps": 2_000,
            "fixedSlotCount": 16,
            "tenureRatesLocked": True,
            "redemptionsUseConstantTimeEffectiveSupply": True,
            "checkpointAllExists": False,
            "defaultStrategyBribeBps": DEFAULT_STRATEGY_BRIBE_BPS,
            "maximumStrategyBribeBps": MAX_STRATEGY_BRIBE_BPS,
            "minimumStrategyBribeBps": 0,
            "strategyFundBpsIsDerived": True,
        },
        "mining": {
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
                "halvingAmount": 490_000_000 * WAD,
                "globalRateBefore": global_tps,
                "globalRateAfter": global_tps // 2,
                "incumbentSlotRateAfterThreshold": incumbent,
                "nextReplacementSlotRate": post_halving,
                "aggregateLockedSixteenSlots": sum(all_slot_rates),
            },
            "infiniteTail": {
                "tailRatePerSecond": 10**16,
                "annualTailEmission": 10**16 * YEAR,
                "years": [
                    {"years": years, "emission": 10**16 * YEAR * years} for years in (1, 10, 100)
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
