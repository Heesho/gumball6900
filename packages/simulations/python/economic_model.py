"""Independent integer-only model of multislot mining and redemption checkpointing."""

from __future__ import annotations

import json

WAD = 10**18
BPS = 10_000
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


def compute() -> dict[str, object]:
    incumbent = 100 * WAD
    capacity = 3
    new_slot = incumbent // capacity
    supply = 100_000_000 * WAD
    pending = 1_000_000 * WAD
    fund_usdg = 50_000_000 * 10**6
    redeem = 1_000_000 * WAD
    return {
        "schemaVersion": 5,
        "purpose": "Deterministic protocol mechanics; not forecasts, valuations, or investment projections.",
        "assumptions": {
            "genesisLiquidityAllocationGBXRaw": GENESIS,
            "infiniteSupply": True,
            "priceDecaySeconds": HOUR,
            "previousMinerBps": 8_000,
            "resonanceRevenueBps": 2_000,
            "maximumCapacity": 16,
            "tenureRatesLocked": True,
            "capacityOnlyIncreases": True,
            "redemptionsCheckpointAllSlots": True,
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
            "capacityExpansion": {
                "capacityBefore": 1,
                "capacityAfter": capacity,
                "incumbentRatePerHour": incumbent,
                "incumbentRateAfterExpansionPerHour": incumbent,
                "newSlotRatePerHour": new_slot,
                "oneHourEmissions": [incumbent, new_slot, new_slot],
                "aggregateOneHourEmission": incumbent + new_slot * 2,
                "undividedGlobalRatePerHour": incumbent,
                "explanation": "Occupied slots keep their tenure rate. Only newly occupied or replaced slots divide the current global rate by current capacity.",
            },
            "handoffHalving": {
                "halvingAmount": 490_000_000 * WAD,
                "globalRateBefore": 100 * WAD,
                "globalRateAfter": 50 * WAD,
                "incumbentRateAfterThreshold": 100 * WAD,
                "nextReplacementRateAtCapacityThree": 50 * WAD // 3,
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
            "supplyBeforeCheckpoint": supply,
            "pendingMining": pending,
            "denominatorAfterCheckpoint": supply + pending,
            "fundUSDGRaw": fund_usdg,
            "redeemGBX": redeem,
            "payoutWithoutCheckpointRaw": mul_div(fund_usdg, redeem, supply),
            "payoutWithCheckpointRaw": mul_div(fund_usdg, redeem, supply + pending),
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
            "completePaymentIsFundLiability": True,
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
