"""Independent reference calculations for committed Mine scenarios."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

WAD = 10**18
GENESIS_LP_GBX = 20_000_000 * WAD


def mul_div(a: int, b: int, denominator: int) -> int:
    return a * b // denominator


def mining_price(initial: int, elapsed: int) -> int:
    return 0 if elapsed >= 3_600 else initial - mul_div(initial, elapsed, 3_600)


def mining_rate(elapsed_since_start: int, initial: int, halving_period: int, tail: int) -> int:
    halvings = elapsed_since_start // halving_period
    return max(initial >> halvings, tail)


def synchronized_mining_emission(
    elapsed_since_start: int, initial: int, halving_period: int, tail: int
) -> int:
    if elapsed_since_start < 0 or halving_period <= 0 or initial <= 0 or tail <= 0:
        raise ValueError("invalid synchronized mining input")

    emission = 0
    remaining = elapsed_since_start
    for era in range(256):
        if remaining == 0:
            return emission
        shifted = initial >> era
        if shifted <= tail:
            return emission + tail * remaining
        active_seconds = min(remaining, halving_period)
        emission += shifted * active_seconds
        remaining -= active_seconds
    raise ValueError("positive tail must be reached within uint256 shift bounds")


def auction_price(initial: int, elapsed: int, duration: int) -> int:
    return 0 if elapsed >= duration else initial - mul_div(initial, elapsed, duration)


def classify_payment(payment: int, remainder: int = 0, bribe_bps: int = 1_000) -> tuple[int, int, int]:
    if payment < 0 or remainder < 0 or remainder >= 10_000 or bribe_bps < 0 or bribe_bps > 2_000:
        raise ValueError("invalid payment classification input")
    base_bribe, raw_remainder = divmod(payment * bribe_bps, 10_000)
    bribe_carry, next_remainder = divmod(remainder + raw_remainder, 10_000)
    bribe = base_bribe + bribe_carry
    return payment - bribe, bribe, next_remainder


def compute(scenarios: dict[str, Any]) -> dict[str, Any]:
    mining_quotes = []
    for case in scenarios["miningCases"]:
        payment = int(case["payment"])
        previous = mul_div(payment, 8_000, 10_000) if case["hasPreviousMiner"] else 0
        seconds = int(case["accrualSeconds"])
        emissions = [int(rate) * seconds for rate in case["slotTps"]]
        next_global = mining_rate(
            int(case["elapsedSinceStart"]),
            int(case["initialTps"]),
            int(case["halvingPeriod"]),
            int(case["tailTps"]),
        )
        synchronized_emission = synchronized_mining_emission(
            int(case["elapsedSinceStart"]),
            int(case["initialTps"]),
            int(case["halvingPeriod"]),
            int(case["tailTps"]),
        )
        mining_quotes.append(
            {
                "id": case["id"],
                "price": str(mining_price(int(case["initialPrice"]), int(case["elapsedSeconds"]))),
                "previousMinerAmount": str(previous),
                "resonanceAmount": str(payment - previous),
                "slotEmissions": [str(value) for value in emissions],
                "totalEmission": str(sum(emissions)),
                "nextGlobalTps": str(next_global),
                "nextSlotTps": str(next_global // 16),
                "synchronizedMiningEmission": str(synchronized_emission),
                "synchronizedGrossSupply": str(GENESIS_LP_GBX + synchronized_emission),
            }
        )

    auction_quotes = []
    for case in scenarios["auctionCases"]:
        payment = auction_price(int(case["initPrice"]), int(case["elapsedSeconds"]), int(case["epochPeriod"]))
        next_price = max(mul_div(payment, int(case["priceMultiplier"]), WAD), int(case["minInitPrice"]))
        bribe_bps = int(case["bribeBps"])
        partition_bps = [int(value) for value in case["paymentPartitionBps"]]
        if len(partition_bps) != len(case["paymentPartitions"]):
            raise ValueError("every payment partition needs one Bribe rate")
        fund, bribe, remainder = classify_payment(int(case["actualTargetReceived"]), 0, bribe_bps)
        partition_fund = 0
        partition_bribe = 0
        partition_remainder = 0
        for part, part_bps in zip(case["paymentPartitions"], partition_bps, strict=True):
            part_fund, part_bribe, partition_remainder = classify_payment(
                int(part), partition_remainder, part_bps
            )
            partition_fund += part_fund
            partition_bribe += part_bribe
        auction_quotes.append(
            {
                "id": case["id"],
                "paymentAmount": str(payment),
                "nextInitPrice": str(next_price),
                "bribeBasisPoints": str(bribe_bps),
                "fundAmount": str(fund),
                "bribeAmount": str(bribe),
                "splitRemainder": str(remainder),
                "partitionFundAmount": str(partition_fund),
                "partitionBribeAmount": str(partition_bribe),
                "partitionRemainder": str(partition_remainder),
                "partitionBribeBasisPoints": [str(value) for value in partition_bps],
            }
        )

    reward_quotes = []
    for case in scenarios["rewardCases"]:
        reward = int(case["rewardAmount"])
        weight = int(case["totalActiveWeight"])
        precision = int(case["precision"])
        increment = mul_div(reward, precision, weight)
        indexed = mul_div(increment, weight, precision)
        earned = int(case["userAccrued"]) + mul_div(
            int(case["userActiveWeight"]), increment - int(case["userRewardPerWeightPaid"]), precision
        )
        reward_quotes.append(
            {
                "id": case["id"],
                "rewardPerWeightIncrement": str(increment),
                "indexedReward": str(indexed),
                "residue": str(reward - indexed),
                "userEarned": str(earned),
            }
        )

    redemption_quotes = []
    for case in scenarios["redemptionCases"]:
        shares = int(case["shares"])
        supply = int(case["supplyBefore"])
        redemption_quotes.append(
            {
                "id": case["id"],
                "percentageWad": str(mul_div(shares, WAD, supply)),
                "outputs": [
                    {"asset": asset["asset"], "amount": str(mul_div(int(asset["balance"]), shares, supply))}
                    for asset in case["assets"]
                ],
            }
        )

    supply_quotes = []
    for case in scenarios["supplyCases"]:
        supply = int(case["lifetimeMinted"]) - int(case["lifetimeBurned"])
        change = int(case["gbxMined"]) - int(case["gbxBurned"])
        supply_quotes.append(
            {
                "id": case["id"],
                "currentSupply": str(supply),
                "netSupplyChange": str(change),
                "projectedSupply": str(supply + change),
            }
        )

    return {
        "schemaVersion": scenarios["schemaVersion"],
        "usdGDecimals": scenarios["usdGDecimals"],
        "targetDecimals": scenarios["targetDecimals"],
        "infiniteSupply": True,
        "genesisLiquidityAllocation": str(GENESIS_LP_GBX),
        "miningQuotes": mining_quotes,
        "auctionQuotes": auction_quotes,
        "rewardQuotes": reward_quotes,
        "redemptionQuotes": redemption_quotes,
        "supplyQuotes": supply_quotes,
    }


if __name__ == "__main__":
    path = Path(sys.argv[1])
    print(json.dumps(compute(json.loads(path.read_text())), indent=2))
